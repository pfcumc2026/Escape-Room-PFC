import { registrarAuditoria } from "../services/auditoria.js";
import * as autenticacao from "../services/autenticacao.js";

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
