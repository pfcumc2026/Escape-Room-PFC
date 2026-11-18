import * as partidas from "../services/partidas.js";

export async function obter(req, res) {
  res.json({ game: await partidas.obterPartida(req.ctx, req.usuario, req.params.gid) });
}

export async function criar(req, res) {
  res.status(201).json(await partidas.criarPartida(req.ctx, req.usuario, req.params.gid, req.body));
}

export async function entrar(req, res) {
  await partidas.entrarNaPartida(req.ctx, req.usuario, req.params.gid);
  res.status(204).end();
}

export async function iniciar(req, res) {
  await partidas.iniciarPartida(req.ctx, req.usuario, req.params.gid);
  res.status(204).end();
}

export async function registrarPista(req, res) {
  await partidas.registrarPista(req.ctx, req.usuario, req.params.gid, req.params.objeto);
  res.status(204).end();
}

export async function registrarEnigma(req, res) {
  await partidas.registrarEnigma(req.ctx, req.usuario, req.params.gid, req.params.chave, req.body);
  res.status(204).end();
}

export async function encerrar(req, res) {
  await partidas.encerrarPartida(req.ctx, req.usuario, req.params.gid, req.body);
  res.status(204).end();
}

export async function excluir(req, res) {
  await partidas.excluirPartida(req.ctx, req.usuario, req.params.gid);
  res.status(204).end();
}
