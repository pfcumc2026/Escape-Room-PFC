import { Router } from "express";
import * as c from "../controllers/convitesController.js";
import { jogador } from "../middleware/autenticacao.js";

export function rotasConvites() {
  const r = Router();
  r.use(jogador);

  r.get("/received", c.recebidos);
  r.get("/sent", c.enviados);
  r.post("/:id/response", c.responder);
  r.delete("/:id", c.cancelar);
  return r;
}
