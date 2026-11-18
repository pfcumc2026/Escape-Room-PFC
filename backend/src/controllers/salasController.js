import * as salas from "../services/salas.js";
import { registrarAuditoria } from "../services/auditoria.js";

export async function obter(req, res) {
  res.json(await salas.obterSala(req.ctx, req.usuario, req.params.id, { rascunho: req.query.draft === "1" }));
}

export async function salvar(req, res) {
  const sala = await salas.salvarSala(req.ctx, req.params.id, req.body);
  await registrarAuditoria(req.ctx, req.usuario, "sala_salva", `${sala.id}${sala.publicada ? " (publicada)" : " (rascunho)"}`);
  res.json(sala);
}
