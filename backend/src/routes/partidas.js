import { Router } from "express";
import * as c from "../controllers/partidasController.js";
import { jogador } from "../middleware/autenticacao.js";

export function rotasPartidas() {
  const r = Router();
  r.use(jogador);

  r.get("/:gid", c.obter);
  r.post("/:gid", c.criar);
  r.delete("/:gid", c.excluir);
  r.post("/:gid/players", c.entrar);
  r.post("/:gid/start", c.iniciar);
  r.post("/:gid/clues/:objeto", c.registrarPista);
  r.post("/:gid/puzzles/:chave", c.registrarEnigma);
  r.post("/:gid/end", c.encerrar);
  return r;
}
