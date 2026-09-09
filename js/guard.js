// Controle de acesso das páginas protegidas

import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { iniciarTema, icones, pronto } from "./ui.js";

const parar = () => new Promise(() => {});

export function usuarioAtual() {
  return new Promise((resolve) => {
    const cancelar = onAuthStateChanged(auth, (u) => { cancelar(); resolve(u); });
  });
}

async function tokenAtualizado(user) {
  const res = await user.getIdTokenResult();
  if (user.emailVerified && res.claims.email_verified !== true) await user.getIdToken(true);
}

export async function exigirAutenticacao({ exigirPerfil = true } = {}) {
  iniciarTema();
  const user = await usuarioAtual();
  if (!user) { location.replace("login.html"); return parar(); }
  if (!user.emailVerified) { location.replace("verificar-email.html"); return parar(); }
  await tokenAtualizado(user);

  const snap = await getDoc(doc(db, "users", user.uid));
  const perfil = snap.exists() ? snap.data() : null;
  const completo = !!(perfil && perfil.profileComplete);
  if (exigirPerfil && !completo) { location.replace("perfil.html"); return parar(); }

  pronto();
  icones();
  return { user, perfil, perfilCompleto: completo };
}

export async function redirecionarSeLogado() {
  iniciarTema();
  const user = await usuarioAtual();
  if (user && user.emailVerified) {
    const snap = await getDoc(doc(db, "users", user.uid));
    location.replace(snap.exists() && snap.data().profileComplete ? "dashboard.html" : "perfil.html");
    return parar();
  }
  if (user && !user.emailVerified) { location.replace("verificar-email.html"); return parar(); }
  pronto();
  icones();
  return null;
}

export async function rotearAposLogin(user) {
  if (!user.emailVerified) { location.replace("verificar-email.html"); return; }
  await tokenAtualizado(user);
  const snap = await getDoc(doc(db, "users", user.uid));
  const destino = new URLSearchParams(location.search).get("proximo");
  if (snap.exists() && snap.data().profileComplete) {
    location.replace(destino && /^[a-z-]+\.html(\?[\w=&%.-]*)?$/.test(destino) ? destino : "dashboard.html");
  } else {
    location.replace("perfil.html");
  }
}

export async function sair() {
  try { await signOut(auth); } finally { location.replace("login.html"); }
}
