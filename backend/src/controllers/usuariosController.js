import * as contas from "../services/contas.js";
import { naoEncontrado } from "../utils/erros.js";
import { buscarPorId, dadosProprios, perfilPublico } from "../services/usuarios.js";

export function eu(req, res) {
  res.json(dadosProprios(req.usuario));
}

export async function atualizarPerfil(req, res) {
  res.json(await contas.atualizarPerfil(req.ctx, req.usuario, req.body));
}

export async function excluirConta(req, res) {
  await contas.excluirConta(req.ctx, req.usuario, req.body, req.sessaoEmitidaEm);
  res.status(204).end();
}

export async function usernameDisponivel(req, res) {
  res.json({ available: await contas.usernameDisponivel(req.ctx, req.params.username) });
}

export async function perfil(req, res) {
  const usuario = await buscarPorId(req.ctx, req.params.uid);
  if (!usuario) throw naoEncontrado("Usuário não encontrado.", "USUARIO_INEXISTENTE");
  res.json(perfilPublico(usuario));
}

export function presenca(req, res) {
  res.json({ online: req.ctx.tempoReal.online(req.params.uid) });
}
