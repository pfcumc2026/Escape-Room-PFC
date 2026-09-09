// Login por e-mail/senha, Google e segundo fator (TOTP)

import { auth, googleProvider } from "./firebase.js";
import {
  signInWithEmailAndPassword, signInWithPopup,
  getMultiFactorResolver, TotpMultiFactorGenerator
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { redirecionarSeLogado, rotearAposLogin } from "./guard.js";
import { icones, toast, erro, carregando } from "./ui.js";

await redirecionarSeLogado();
icones();

const form = document.getElementById("form-login");
const btn = document.getElementById("btn-entrar");
const bloco2fa = document.getElementById("bloco-2fa");
let resolvedor = null;

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = form.email.value.trim();
  const senha = form.senha.value;
  if (!email || !senha) { toast("Preencha e-mail e senha.", "err"); return; }

  carregando(btn, true, "Entrando...");
  try {
    const cred = await signInWithEmailAndPassword(auth, email, senha);
    await rotearAposLogin(cred.user);
  } catch (e) {
    if (e.code === "auth/multi-factor-auth-required") {
      resolvedor = getMultiFactorResolver(auth, e);
      bloco2fa.classList.remove("d-none");
      document.getElementById("codigo-2fa").focus();
      toast("Informe o código do seu aplicativo autenticador.", "info");
    } else {
      erro(e, "Não foi possível entrar.");
    }
    carregando(btn, false);
  }
});

document.getElementById("btn-2fa").addEventListener("click", async () => {
  if (!resolvedor) return;
  const codigo = document.getElementById("codigo-2fa").value.replace(/\D/g, "");
  if (codigo.length !== 6) { toast("Digite os 6 dígitos do código.", "err"); return; }
  const fator = resolvedor.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) || resolvedor.hints[0];
  try {
    const assercao = TotpMultiFactorGenerator.assertionForSignIn(fator.uid, codigo);
    const cred = await resolvedor.resolveSignIn(assercao);
    await rotearAposLogin(cred.user);
  } catch (e) {
    erro(e, "Código inválido ou expirado.");
  }
});

document.getElementById("btn-google").addEventListener("click", async () => {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await rotearAposLogin(cred.user);
  } catch (e) {
    if (e.code === "auth/multi-factor-auth-required") {
      resolvedor = getMultiFactorResolver(auth, e);
      bloco2fa.classList.remove("d-none");
      document.getElementById("codigo-2fa").focus();
      return;
    }
    erro(e, "Não foi possível entrar com o Google.");
  }
});
