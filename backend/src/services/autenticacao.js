import bcrypt from "bcrypt";
import {
  conflito, ehChaveDuplicada, indisponivel, muitasTentativas, naoAutenticado, requisicaoInvalida
} from "../utils/erros.js";
import { LIMITES, codigoNumerico, normalizarEmail, texto, validarSenha } from "../utils/validacao.js";
import { registrarAuditoria } from "./auditoria.js";
import { emailRedefinicao, emailVerificacao } from "./email.js";
import { emitirSessao } from "./sessao.js";
import { apagarTokens, buscarToken, consumirToken, criarToken, registrarFalha } from "./tokensUsoUnico.js";
import { buscarPorEmail, buscarPorId, novoUsuario } from "./usuarios.js";
import { conferirSegundoFator } from "./doisFatores.js";
import { migrarConta } from "./migracao.js";

export const CUSTO_BCRYPT = 12;
const VERSAO_TERMOS = "1.0";
const MAX_TENTATIVAS_CODIGO = 5;
const MINUTOS_REAUTENTICACAO = 10;

// Comparação com um hash qualquer quando a conta não existe: a resposta leva o mesmo tempo
const HASH_FICTICIO = bcrypt.hashSync("conta-inexistente-0", CUSTO_BCRYPT);

const credenciaisInvalidas = () => naoAutenticado("E-mail ou senha incorretos.", "CREDENCIAIS_INVALIDAS");
const desafioExpirado = () => naoAutenticado("A verificação expirou. Entre novamente.", "DESAFIO_EXPIRADO");

// Conta que ainda depende do 2FA antigo: sem a consulta ao Firebase, o login é recusado em vez de pular o segundo fator
export function exigirLegado(ctx) {
  if (!ctx.legado) throw indisponivel("A migração desta conta está indisponível no momento. Tente novamente mais tarde.", "MIGRACAO_INDISPONIVEL");
}

export function gerarHash(senha) {
  return bcrypt.hash(senha, CUSTO_BCRYPT);
}

// Cadastro e e-mail

export async function cadastrar(ctx, corpo) {
  const nome = texto(corpo.name, "o nome", { max: LIMITES.nomeMax });
  if (nome.length < 2) throw requisicaoInvalida("Informe seu nome.");
  const email = normalizarEmail(corpo.email);
  const senha = validarSenha(corpo.password);
  if (corpo.acceptTerms !== true) throw requisicaoInvalida("Aceite o Termo de Aceite e a Política de Privacidade.", "TERMOS_NAO_ACEITOS");
  if (!ctx.email.configurado) throw indisponivel("O cadastro está indisponível: o envio de e-mails não foi configurado.", "EMAIL_INDISPONIVEL");

  const usuario = novoUsuario({
    email, name: nome, passwordHash: await gerarHash(senha),
    extras: { termsVersion: VERSAO_TERMOS, termsAcceptedAt: new Date() }
  });
  try {
    usuario._id = (await ctx.db.collection("users").insertOne(usuario)).insertedId;
  } catch (e) {
    if (ehChaveDuplicada(e, "email")) throw conflito("Este e-mail já possui cadastro.", "EMAIL_EM_USO");
    throw e;
  }

  await registrarAuditoria(ctx, usuario, "cadastro", "E-mail e senha");
  await registrarAuditoria(ctx, usuario, "termos_aceitos", `Termo de Aceite e Política de Privacidade v${VERSAO_TERMOS}`);
  const emailEnviado = await enviarVerificacao(ctx, usuario).then(() => true, (e) => {
    console.error("[cadastro] e-mail de verificação", e.message);
    return false;
  });
  return { ...emitirSessao(ctx, usuario), emailEnviado };
}

export async function enviarVerificacao(ctx, usuario) {
  await apagarTokens(ctx, usuario._id, "verificacao-email");
  const token = await criarToken(ctx, { tipo: "verificacao-email", usuarioId: usuario._id, minutos: 24 * 60 });
  const link = `${ctx.config.frontendUrl}/verificar-email.html?token=${encodeURIComponent(token)}`;
  const mensagem = emailVerificacao(usuario.name, link);
  await ctx.email.enviar({ para: usuario.email, assunto: mensagem.assunto, texto: mensagem.texto, html: mensagem.html });
}

export async function reenviarVerificacao(ctx, usuario) {
  if (usuario.emailVerified) throw conflito("Seu e-mail já está verificado.", "EMAIL_JA_VERIFICADO");
  await enviarVerificacao(ctx, usuario);
}

export async function confirmarEmail(ctx, token) {
  const registro = await consumirToken(ctx, token, "verificacao-email");
  if (!registro) throw requisicaoInvalida("Link de verificação inválido ou expirado. Peça um novo.", "TOKEN_INVALIDO");
  const usuario = await ctx.db.collection("users").findOneAndUpdate(
    { _id: registro.userId },
    { $set: { emailVerified: true, updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  if (!usuario) throw requisicaoInvalida("Esta conta não existe mais.", "TOKEN_INVALIDO");
  await registrarAuditoria(ctx, usuario, "email_verificado");
}

// Login: primeiro fator

export async function entrar(ctx, corpo) {
  const email = normalizarEmail(corpo.email);
  const senha = typeof corpo.password === "string" ? corpo.password : "";
  if (!senha || senha.length > 200) throw credenciaisInvalidas();

  const usuario = await buscarPorEmail(ctx, email);
  if (usuario?.legacy?.pendingTwoFactor) {
    exigirLegado(ctx);
    return entrarPeloLegado(ctx, email, senha, usuario);
  }
  if (!usuario) {
    if (ctx.legado) return entrarPeloLegado(ctx, email, senha, null);
    await bcrypt.compare(senha, HASH_FICTICIO);
    throw credenciaisInvalidas();
  }

  const confere = await bcrypt.compare(senha, usuario.passwordHash || HASH_FICTICIO);
  if (!confere || !usuario.passwordHash) {
    // Alguém pode ter cadastrado o e-mail de uma conta antiga sem confirmá-lo; o dono comprova pela conta antiga
    if (ctx.legado && !usuario.emailVerified && !usuario.firebaseUid) return entrarPeloLegado(ctx, email, senha, usuario);
    throw credenciaisInvalidas();
  }
  return concluirPrimeiroFator(ctx, usuario, "E-mail e senha");
}

async function entrarPeloLegado(ctx, email, senha, existente) {
  const resultado = await ctx.legado.entrarComSenha(email, senha);
  if (resultado.situacao === "invalida") throw credenciaisInvalidas();

  const senhaHash = await gerarHash(senha);
  if (resultado.situacao === "mfa") {
    return desafioLegado(ctx, resultado, { senhaHash, existenteId: existente?._id || null });
  }
  return finalizarMigracao(ctx, { idToken: resultado.idToken, senhaHash, existente }, "E-mail e senha (conta migrada)");
}

export async function desafioLegado(ctx, resultado, dados) {
  const desafio = await criarToken(ctx, {
    tipo: "2fa-legado", minutos: 5,
    dados: { pendente: resultado.pendente, inscricao: resultado.inscricao, ...dados }
  });
  return { etapa: "2fa-legado", desafio };
}

export async function finalizarMigracao(ctx, opcoes, metodo) {
  const usuario = await migrarConta(ctx, opcoes);
  await registrarAuditoria(ctx, usuario, "conta_migrada", metodo);
  if (usuario.legacy?.pendingTwoFactor) {
    await apagarTokens(ctx, usuario._id, "configurar-2fa");
    const desafio = await criarToken(ctx, { tipo: "configurar-2fa", usuarioId: usuario._id, minutos: 15 });
    return { etapa: "configurar-2fa", desafio };
  }
  return concluirPrimeiroFator(ctx, usuario, metodo);
}

// A sessão completa só é emitida depois de todos os fatores exigidos pela conta
export async function concluirPrimeiroFator(ctx, usuario, metodo) {
  if (usuario.twoFactor?.enabled) {
    const desafio = await criarToken(ctx, { tipo: "2fa", usuarioId: usuario._id, minutos: 5, dados: { metodo } });
    return { etapa: "2fa", desafio };
  }
  await registrarAuditoria(ctx, usuario, "login", metodo);
  return emitirSessao(ctx, usuario);
}

// Login: segundo fator

async function contarFalha(ctx, registro) {
  if (await registrarFalha(ctx, registro) >= MAX_TENTATIVAS_CODIGO) {
    await ctx.db.collection("authTokens").deleteOne({ _id: registro._id });
    throw muitasTentativas("Muitas tentativas inválidas. Entre novamente.");
  }
  throw naoAutenticado("Código inválido. Confira o aplicativo autenticador.", "CODIGO_INVALIDO");
}

export async function verificarSegundoFator(ctx, corpo) {
  const registro = await buscarToken(ctx, corpo.challenge, "2fa");
  if (!registro) throw desafioExpirado();
  const usuario = await buscarPorId(ctx, registro.userId);
  if (!usuario?.twoFactor?.enabled) throw desafioExpirado();

  const recuperacao = typeof corpo.recoveryCode === "string" && corpo.recoveryCode.trim() ? corpo.recoveryCode : null;
  const codigo = recuperacao ? null : codigoNumerico(corpo.code);
  if (!await conferirSegundoFator(ctx, usuario, { code: codigo, recoveryCode: recuperacao })) return contarFalha(ctx, registro);
  if (!await consumirToken(ctx, corpo.challenge, "2fa")) throw desafioExpirado();

  await registrarAuditoria(ctx, usuario, "login", `${registro.data?.metodo || "Login"} + ${recuperacao ? "código de recuperação" : "verificação em duas etapas"}`);
  return emitirSessao(ctx, await buscarPorId(ctx, usuario._id));
}

// O código do autenticador antigo é conferido pelo próprio Firebase, onde o segredo continua guardado
export async function verificarSegundoFatorLegado(ctx, corpo) {
  if (!ctx.legado) throw desafioExpirado();
  const registro = await buscarToken(ctx, corpo.challenge, "2fa-legado");
  if (!registro) throw desafioExpirado();
  const codigo = codigoNumerico(corpo.code);

  const idToken = await ctx.legado.concluirSegundoFator(registro.data.pendente, registro.data.inscricao, codigo);
  if (!idToken) return contarFalha(ctx, registro);
  if (!await consumirToken(ctx, corpo.challenge, "2fa-legado")) throw desafioExpirado();

  const existente = registro.data.existenteId ? await buscarPorId(ctx, registro.data.existenteId) : null;
  return finalizarMigracao(ctx, {
    idToken, senhaHash: registro.data.senhaHash, googleSub: registro.data.googleSub, comSegundoFator: true, existente
  }, "Conta migrada com verificação em duas etapas");
}

export async function usuarioDoDesafioDeConfiguracao(ctx, desafio) {
  const registro = await buscarToken(ctx, desafio, "configurar-2fa");
  const usuario = registro && await buscarPorId(ctx, registro.userId);
  if (!usuario?.legacy?.pendingTwoFactor) throw desafioExpirado();
  return usuario;
}

export async function encerrarDesafioDeConfiguracao(ctx, desafio) {
  await consumirToken(ctx, desafio, "configurar-2fa");
}

// Ações sensíveis com a sessão aberta: senha, ou login recente para contas sem senha (somente Google)
export async function confirmarIdentidade(usuario, senha, sessaoEmitidaEm) {
  if (usuario.passwordHash) {
    if (typeof senha !== "string" || !senha || !await bcrypt.compare(senha, usuario.passwordHash)) {
      throw naoAutenticado("Senha incorreta.", "SENHA_INCORRETA");
    }
    return;
  }
  if (Date.now() - sessaoEmitidaEm > MINUTOS_REAUTENTICACAO * 60 * 1000) {
    throw naoAutenticado("Por segurança, entre novamente para concluir esta ação.", "REAUTENTICACAO_NECESSARIA");
  }
}

// Recuperação de senha

export async function solicitarRedefinicao(ctx, corpo) {
  const email = normalizarEmail(corpo.email);
  if (!ctx.email.configurado) throw indisponivel("A recuperação de senha está indisponível: o envio de e-mails não foi configurado.", "EMAIL_INDISPONIVEL");

  const usuario = await buscarPorEmail(ctx, email);
  if (!usuario) {
    if (ctx.legado) await ctx.legado.enviarRedefinicao(email);
    return;
  }
  // Enquanto o novo 2FA não é cadastrado, a conta continua entrando pelo fluxo antigo
  if (usuario.legacy?.pendingTwoFactor) return;

  await apagarTokens(ctx, usuario._id, "redefinicao-senha");
  const token = await criarToken(ctx, { tipo: "redefinicao-senha", usuarioId: usuario._id, minutos: 60 });
  const link = `${ctx.config.frontendUrl}/redefinir-senha.html?token=${encodeURIComponent(token)}`;
  const mensagem = emailRedefinicao(usuario.name, link);
  await ctx.email.enviar({ para: usuario.email, assunto: mensagem.assunto, texto: mensagem.texto, html: mensagem.html });
  await registrarAuditoria(ctx, usuario, "troca_senha", "Link de redefinição enviado");
}

export async function redefinirSenha(ctx, corpo) {
  const senha = validarSenha(corpo.password);
  const registro = await consumirToken(ctx, corpo.token, "redefinicao-senha");
  if (!registro) throw requisicaoInvalida("Link de redefinição inválido ou expirado. Peça um novo.", "TOKEN_INVALIDO");

  // Quem abriu o link comprovou o acesso ao e-mail; as sessões anteriores deixam de valer
  const usuario = await ctx.db.collection("users").findOneAndUpdate(
    { _id: registro.userId },
    { $set: { passwordHash: await gerarHash(senha), emailVerified: true, updatedAt: new Date() }, $inc: { sessionVersion: 1 } },
    { returnDocument: "after" }
  );
  if (!usuario) throw requisicaoInvalida("Esta conta não existe mais.", "TOKEN_INVALIDO");
  await apagarTokens(ctx, usuario._id, "redefinicao-senha");
  await registrarAuditoria(ctx, usuario, "senha_redefinida");
}
