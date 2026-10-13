import { listarAuditoria } from "../services/auditoria.js";

export async function listar(req, res) {
  const limite = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 300, 1), 1000);
  res.json(await listarAuditoria(req.ctx, limite));
}
