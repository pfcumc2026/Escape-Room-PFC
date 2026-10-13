import bcrypt from "bcrypt";
import { conflito, ehChaveDuplicada, indisponivel, naoAutenticado, requisicaoInvalida } from "../utils/erros.js";
import { LIMITES, normalizarEmail, texto, validarSenha } from "../utils/validacao.js";
import { registrarAuditoria } from "./auditoria.js";
import { emailRedefinicao, emailVerificacao } from "./email.js";
import { emitirSessao } from "./sessao.js";
import { apagarTokens, consumirToken, criarToken } from "./tokensUsoUnico.js";
import { buscarPorEmail, novoUsuario } from "./usuarios.js";
import { migrarConta } from "./migracao.js";

export const CUSTO_BCRYPT = 12;
const VERSAO_TERMOS = "1.0";
const MINUTOS_REAUTENTICACAO = 10;

// Comparação com um hash qualquer quando a conta não existe: a resposta leva o mesmo tempo
const HASH_FICTICIO = bcrypt.hashSync("conta-inexistente-0", CUSTO_BCRYPT);

const credenciaisInvalidas = () => naoAutenticado("E-mail ou senha incorretos.", "CREDENCIAIS_INVALIDAS");

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
  return concluirLogin(ctx, usuario, "E-mail e senha");
}

async function entrarPeloLegado(ctx, email, senha, existente) {
  const resultado = await ctx.legado.entrarComSenha(email, senha);
  if (resultado.situacao === "invalida") throw credenciaisInvalidas();
  if (resultado.situacao === "mfa") {
    throw indisponivel("Esta conta usa verificação em duas etapas no sistema antigo e ainda não pode ser migrada.", "MIGRACAO_2FA_PENDENTE");
  }

  const usuario = await migrarConta(ctx, { idToken: resultado.idToken, senhaHash: await gerarHash(senha), existente });
  await registrarAuditoria(ctx, usuario, "conta_migrada", "E-mail e senha");
  return concluirLogin(ctx, usuario, "E-mail e senha (conta migrada)");
}

async function concluirLogin(ctx, usuario, metodo) {
  await registrarAuditoria(ctx, usuario, "login", metodo);
  return emitirSessao(ctx, usuario);
}

// Ações sensíveis com a sessão aberta: senha, ou login recente para contas sem senha
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
