// Tela de verificação de e-mail

import { auth } from "./firebase.js";
import { sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { usuarioAtual, rotearAposLogin, sair } from "./guard.js";
import { iniciarTema, icones, toast, erro, carregando, pronto, setTexto } from "./ui.js";

iniciarTema();
const user = await usuarioAtual();
if (!user) location.replace("login.html");
if (user && user.emailVerified) await rotearAposLogin(user);

pronto();
icones();
setTexto("#email-usuario", user.email || "");

const btnVerificar = document.getElementById("btn-verificar");
const btnReenviar = document.getElementById("btn-reenviar");

btnVerificar.addEventListener("click", async () => {
  carregando(btnVerificar, true, "Verificando...");
  try {
    await user.reload();
    if (user.emailVerified) {
      await user.getIdToken(true);
      toast("E-mail verificado.", "ok");
      await rotearAposLogin(user);
    } else {
      toast("O e-mail ainda não consta como verificado. Confira sua caixa de entrada e o spam.", "err", 6000);
    }
  } catch (e) {
    erro(e, "Não foi possível checar o status.");
  }
  carregando(btnVerificar, false);
});

btnReenviar.addEventListener("click", async () => {
  carregando(btnReenviar, true, "Enviando...");
  try {
    await sendEmailVerification(user);
    toast("Novo e-mail de verificação enviado.", "ok");
  } catch (e) {
    erro(e, "Não foi possível reenviar o e-mail.");
  }
  carregando(btnReenviar, false);
});

document.getElementById("btn-sair").addEventListener("click", sair);
