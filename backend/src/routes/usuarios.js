import { Router } from "express";
import * as c from "../controllers/usuariosController.js";
import { autenticar, exigirEmailVerificado, exigirPerfil } from "../middleware/autenticacao.js";

export function rotasUsuarios() {
  const r = Router();
  const verificado = [autenticar, exigirEmailVerificado];

  r.get("/me", autenticar, c.eu);
  r.patch("/me", verificado, c.atualizarPerfil);
  r.delete("/me", autenticar, c.excluirConta);
  r.get("/me/stats", [...verificado, exigirPerfil], c.estatisticas);
  r.get("/username-available/:username", verificado, c.usernameDisponivel);
  r.get("/:uid", verificado, c.perfil);
  r.get("/:uid/presence", verificado, c.presenca);
  return r;
}
