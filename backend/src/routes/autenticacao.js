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

  r.post("/2fa/verify", limite, c.verificarSegundoFator);
  r.post("/2fa/legacy/verify", limite, c.verificarSegundoFatorLegado);
  r.post("/2fa/setup", limite, autenticar, c.prepararDoisFatores);
  r.post("/2fa/enable", limite, autenticar, c.ativarDoisFatores);
  r.post("/2fa/disable", limite, autenticar, c.desativarDoisFatores);
  r.post("/2fa/recovery-codes", limite, autenticar, c.regenerarCodigos);
  r.post("/2fa/migration/setup", limite, c.prepararDoisFatoresMigracao);
  r.post("/2fa/migration/enable", limite, c.ativarDoisFatoresMigracao);

  r.get("/google", limite, c.iniciarGoogle);
  r.get("/google/callback", c.retornoGoogle);
  r.post("/google/exchange", limite, c.entregarGoogle);
  return r;
}
