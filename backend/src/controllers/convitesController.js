import * as convites from "../services/convites.js";

export async function recebidos(req, res) {
  res.json(await convites.listarRecebidos(req.ctx, String(req.usuario._id)));
}

export async function enviados(req, res) {
  res.json(await convites.listarEnviados(req.ctx, String(req.usuario._id)));
}

export async function responder(req, res) {
  await convites.responderConvite(req.ctx, req.usuario, req.params.id, req.body);
  res.status(204).end();
}

export async function cancelar(req, res) {
  await convites.cancelarConvite(req.ctx, req.usuario, req.params.id);
  res.status(204).end();
}
