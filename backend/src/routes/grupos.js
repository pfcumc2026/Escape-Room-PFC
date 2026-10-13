import { Router } from "express";
import * as c from "../controllers/gruposController.js";
import { jogador } from "../middleware/autenticacao.js";

export function rotasGrupos() {
  const r = Router();
  r.use(jogador);

  r.get("/", c.listar);
  r.post("/", c.criar);
  r.get("/:id", c.obter);
  r.delete("/:id", c.excluir);
  r.post("/:id/invite-code", c.renovarCodigo);
  r.post("/:id/join", c.entrar);
  r.delete("/:id/members/:uid", c.removerMembro);
  r.get("/:id/invites", c.listarConvites);
  r.post("/:id/invites", c.convidar);
  r.get("/:id/messages", c.listarMensagens);
  r.post("/:id/messages", c.enviarMensagem);
  return r;
}
