import * as grupos from "../services/grupos.js";
import * as convites from "../services/convites.js";
import * as chat from "../services/chat.js";

const uid = (req) => String(req.usuario._id);

export async function listar(req, res) {
  res.json(await grupos.listarGrupos(req.ctx, uid(req)));
}

export async function criar(req, res) {
  res.status(201).json(await grupos.criarGrupo(req.ctx, req.usuario, req.body));
}

export async function obter(req, res) {
  res.json(grupos.formatarGrupo(await grupos.grupoComoMembro(req.ctx, req.params.id, uid(req))));
}

export async function excluir(req, res) {
  await grupos.excluirGrupo(req.ctx, req.usuario, req.params.id);
  res.status(204).end();
}

export async function renovarCodigo(req, res) {
  res.json({ inviteCode: await grupos.renovarCodigo(req.ctx, req.usuario, req.params.id) });
}

export async function entrar(req, res) {
  res.json(await grupos.entrarComCodigo(req.ctx, req.usuario, req.params.id, req.body));
}

export async function removerMembro(req, res) {
  await grupos.removerMembro(req.ctx, req.usuario, req.params.id, req.params.uid);
  res.status(204).end();
}

export async function listarConvites(req, res) {
  res.json(await convites.listarPendentesDoGrupo(req.ctx, req.usuario, req.params.id));
}

export async function convidar(req, res) {
  res.status(201).json(await convites.enviarConvite(req.ctx, req.usuario, req.params.id, req.body));
}

export async function listarMensagens(req, res) {
  res.json(await chat.listarMensagens(req.ctx, req.usuario, req.params.id));
}

export async function enviarMensagem(req, res) {
  res.status(201).json(await chat.enviarMensagem(req.ctx, req.usuario, req.params.id, req.body));
}
