// Recuperação de senha pelo fluxo oficial do Firebase

import { auth } from "./firebase.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { iniciarTema, icones, toast, erro, carregando, pronto } from "./ui.js";

iniciarTema();
icones();
pronto();

const form = document.getElementById("form-reset");
const btn = document.getElementById("btn-enviar");

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const email = form.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { toast("Digite um e-mail válido.", "err"); return; }

  carregando(btn, true, "Enviando...");
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (e) {
    if (e.code !== "auth/user-not-found") {
      erro(e, "Não foi possível enviar o e-mail.");
      carregando(btn, false);
      return;
    }
    console.warn("[Placeholder] recuperação solicitada para e-mail inexistente");
  }
  carregando(btn, false);
  toast("Se existir uma conta com esse e-mail, o link de redefinição foi enviado.", "ok", 7000);
  form.reset();
});
