import { Router } from "express";
import * as sistema from "../controllers/sistemaController.js";
import * as salas from "../controllers/salasController.js";
import * as auditoria from "../controllers/auditoriaController.js";
import { autenticar, exigirAdmin, exigirEmailVerificado } from "../middleware/autenticacao.js";

export function rotasSistema() {
  const r = Router();
  const verificado = [autenticar, exigirEmailVerificado];

  r.get("/health", sistema.saude);
  r.get("/time", sistema.tempo);
  r.get("/events", verificado, sistema.eventos);

  r.get("/rooms/:id", verificado, salas.obter);
  r.put("/rooms/:id", verificado, exigirAdmin, salas.salvar);
  r.get("/audit", verificado, exigirAdmin, auditoria.listar);
  return r;
}
