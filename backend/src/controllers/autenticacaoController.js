import { conflito, naoAutenticado, proibido } from "../utils/erros.js";
import { registrarAuditoria } from "../services/auditoria.js";
import * as autenticacao from "../services/autenticacao.js";
import * as doisFatores from "../services/doisFatores.js";
import * as google from "../services/loginGoogle.js";
import { emitirSessao } from "../services/sessao.js";
import { buscarPorId } from "../services/usuarios.js";
import { codigoNumerico } from "../utils/validacao.js";

const COOKIE_GOOGLE = "escape_google_state";

export async function cadastrar(req, res) {
  res.status(201).json(await autenticacao.cadastrar(req.ctx, req.body));
}

export async function entrar(req, res) {
  res.json(await autenticacao.entrar(req.ctx, req.body));
}

export async function sair(req, res) {
  await registrarAuditoria(req.ctx, req.usuario, "logout");
  res.status(204).end();
}

export async function confirmarEmail(req, res) {
  await autenticacao.confirmarEmail(req.ctx, req.body.token);
  res.json({ mensagem: "E-mail verificado." });
}

export async function reenviarVerificacao(req, res) {
  await autenticacao.reenviarVerificacao(req.ctx, req.usuario);
  res.json({ mensagem: "Novo e-mail de verificação enviado." });
}

export async function esqueciSenha(req, res) {
  await autenticacao.solicitarRedefinicao(req.ctx, req.body);
  res.json({ mensagem: "Se existir uma conta com esse e-mail, o link de redefinição foi enviado." });
}

export async function redefinirSenha(req, res) {
  await autenticacao.redefinirSenha(req.ctx, req.body);
  res.json({ mensagem: "Senha redefinida. Entre com a nova senha." });
}

export async function verificarSegundoFator(req, res) {
  res.json(await autenticacao.verificarSegundoFator(req.ctx, req.body));
}

export async function verificarSegundoFatorLegado(req, res) {
  res.json(await autenticacao.verificarSegundoFatorLegado(req.ctx, req.body));
}

// 2FA com a sessão aberta (Configurações)

export async function prepararDoisFatores(req, res) {
  if (!req.usuario.emailVerified) throw proibido("Confirme seu e-mail antes de ativar o 2FA.", "EMAIL_NAO_VERIFICADO");
  if (req.usuario.twoFactor?.enabled) throw conflito("O 2FA já está ativo.", "2FA_ATIVO");
  await autenticacao.confirmarIdentidade(req.usuario, req.body.password, req.sessaoEmitidaEm);
  res.json(await doisFatores.prepararConfiguracao(req.ctx, req.usuario));
}

export async function ativarDoisFatores(req, res) {
  if (req.usuario.twoFactor?.enabled) throw conflito("O 2FA já está ativo.", "2FA_ATIVO");
  const codigos = await doisFatores.ativar(req.ctx, req.usuario, codigoNumerico(req.body.code));
  await registrarAuditoria(req.ctx, req.usuario, "2fa_ativado");
  res.json({ recoveryCodes: codigos });
}

export async function desativarDoisFatores(req, res) {
  if (!req.usuario.twoFactor?.enabled) throw conflito("O 2FA já está desativado.", "2FA_INATIVO");
  await autenticacao.confirmarIdentidade(req.usuario, req.body.password, req.sessaoEmitidaEm);
  const recuperacao = typeof req.body.recoveryCode === "string" && req.body.recoveryCode.trim() ? req.body.recoveryCode : null;
  const valido = await doisFatores.conferirSegundoFator(req.ctx, req.usuario, {
    code: recuperacao ? null : codigoNumerico(req.body.code), recoveryCode: recuperacao
  });
  if (!valido) throw naoAutenticado("Código inválido. Confira o aplicativo autenticador.", "CODIGO_INVALIDO");
  await doisFatores.desativar(req.ctx, req.usuario);
  await registrarAuditoria(req.ctx, req.usuario, "2fa_desativado");
  res.json({ mensagem: "2FA desativado." });
}

// Exige senha e um código do aplicativo (não um código de recuperação, que poderia ter vazado junto com os demais)
export async function regenerarCodigos(req, res) {
  if (!req.usuario.twoFactor?.enabled) throw conflito("O 2FA está desativado.", "2FA_INATIVO");
  await autenticacao.confirmarIdentidade(req.usuario, req.body.password, req.sessaoEmitidaEm);
  if (!await doisFatores.conferirSegundoFator(req.ctx, req.usuario, { code: codigoNumerico(req.body.code) })) {
    throw naoAutenticado("Código inválido. Confira o aplicativo autenticador.", "CODIGO_INVALIDO");
  }
  const codigos = await doisFatores.regenerarCodigos(req.ctx, req.usuario);
  await registrarAuditoria(req.ctx, req.usuario, "codigos_recuperacao_gerados");
  res.json({ recoveryCodes: codigos });
}

// 2FA de contas migradas que tinham 2FA no Firebase: a sessão só sai depois do novo autenticador

export async function prepararDoisFatoresMigracao(req, res) {
  const usuario = await autenticacao.usuarioDoDesafioDeConfiguracao(req.ctx, req.body.challenge);
  res.json(await doisFatores.prepararConfiguracao(req.ctx, usuario));
}

export async function ativarDoisFatoresMigracao(req, res) {
  const usuario = await autenticacao.usuarioDoDesafioDeConfiguracao(req.ctx, req.body.challenge);
  const codigos = await doisFatores.ativar(req.ctx, usuario, codigoNumerico(req.body.code));
  await autenticacao.encerrarDesafioDeConfiguracao(req.ctx, req.body.challenge);
  await registrarAuditoria(req.ctx, usuario, "2fa_ativado", "Novo autenticador após a migração");
  await registrarAuditoria(req.ctx, usuario, "login", "Conta migrada com verificação em duas etapas");
  res.json({ ...emitirSessao(req.ctx, await buscarPorId(req.ctx, usuario._id)), recoveryCodes: codigos });
}

// Google OAuth 2.0 / OpenID Connect

function lerCookie(req, nome) {
  const par = (req.get("cookie") || "").split(";").map((p) => p.trim()).find((p) => p.startsWith(`${nome}=`));
  return par ? decodeURIComponent(par.slice(nome.length + 1)) : "";
}

function opcoesCookie(req) {
  return { httpOnly: true, secure: req.ctx.config.producao, sameSite: "lax", path: "/api/auth/google" };
}

export async function iniciarGoogle(req, res) {
  const { redirecionar, state } = await google.iniciarLoginGoogle(req.ctx, { origem: req.query.origem, proximo: req.query.proximo });
  if (state) res.cookie(COOKIE_GOOGLE, state, { ...opcoesCookie(req), maxAge: 10 * 60 * 1000 });
  res.redirect(302, redirecionar);
}

export async function retornoGoogle(req, res) {
  const destino = await google.concluirLoginGoogle(req.ctx, {
    code: req.query.code,
    state: req.query.state,
    error: req.query.error,
    stateDoCookie: lerCookie(req, COOKIE_GOOGLE)
  });
  res.clearCookie(COOKIE_GOOGLE, opcoesCookie(req));
  res.redirect(302, destino);
}

export async function entregarGoogle(req, res) {
  res.json(await google.entregarLoginGoogle(req.ctx, req.body.code));
}
