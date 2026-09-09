// Cadastro de conta

import { auth, googleProvider, LIMITES } from "./firebase.js";
import {
  createUserWithEmailAndPassword, updateProfile, sendEmailVerification, signInWithPopup
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { redirecionarSeLogado, rotearAposLogin } from "./guard.js";
import { icones, toast, erro, carregando, limparTexto } from "./ui.js";

await redirecionarSeLogado();
icones();

const form = document.getElementById("form-cadastro");
const btn = document.getElementById("btn-cadastrar");

function validar(nome, email, senha, senha2) {
  if (nome.length < 2) return "Informe seu nome.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Digite um e-mail válido.";
  if (senha.length < LIMITES.senhaMin) return `A senha precisa ter pelo menos ${LIMITES.senhaMin} caracteres.`;
  if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) return "A senha precisa conter letras e números.";
  if (senha !== senha2) return "As senhas não coincidem.";
  return null;
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const nome = limparTexto(form.nome.value, 60);
  const email = form.email.value.trim();
  const senha = form.senha.value;
  const problema = validar(nome, email, senha, form.senha2.value);
  if (problema) { toast(problema, "err"); return; }

  carregando(btn, true, "Criando conta...");
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, senha);
    await updateProfile(cred.user, { displayName: nome });
    await sendEmailVerification(cred.user);
    location.replace("verificar-email.html");
  } catch (e) {
    erro(e, "Não foi possível criar a conta.");
    carregando(btn, false);
  }
});

document.getElementById("btn-google").addEventListener("click", async () => {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    await rotearAposLogin(cred.user);
  } catch (e) {
    erro(e, "Não foi possível entrar com o Google.");
  }
});
