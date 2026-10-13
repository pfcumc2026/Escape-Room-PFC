import { Router } from "express";
import * as c from "../controllers/autenticacaoController.js";
import { autenticar } from "../middleware/autenticacao.js";

export function rotasAutenticacao(limites) {
  const r = Router();
  const limite = limites.autenticacao;

  r.post("/register", limite, c.cadastrar);
  r.post("/login", limite, c.entrar);
  r.post("/logout", autenticar, c.sair);

  r.post("/email/verify", limite, c.confirmarEmail);
  r.post("/email/resend", limite, autenticar, c.reenviarVerificacao);
  r.post("/password/forgot", limite, c.esqueciSenha);
  r.post("/password/reset", limite, c.redefinirSenha);
  return r;
}
