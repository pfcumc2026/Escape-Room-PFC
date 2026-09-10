// Entrada em um grupo por link/QR Code

import { db } from "./firebase.js";
import {
  doc, getDoc, writeBatch, arrayUnion, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { usuarioAtual } from "./guard.js";
import { iniciarTema, icones, pronto, setTexto, toast, erro, carregando } from "./ui.js";

iniciarTema();

const parametros = new URLSearchParams(location.search);
const idGrupo = parametros.get("g") || "";
const codigo = parametros.get("c") || "";
const destino = `entrar.html?g=${encodeURIComponent(idGrupo)}&c=${encodeURIComponent(codigo)}`;

const parar = () => new Promise(() => {});
const user = await usuarioAtual();
if (!user) { location.replace(`login.html?proximo=${encodeURIComponent(destino)}`); await parar(); }
if (!user.emailVerified) { location.replace("verificar-email.html"); await parar(); }

pronto();
icones();

const btn = document.getElementById("btn-entrar");

if (!/^[A-Za-z0-9_-]{6,40}$/.test(idGrupo) || !/^[a-z0-9]{8}$/.test(codigo)) {
  setTexto("#estado", "Este link de convite é inválido.");
} else {
  const perfil = await getDoc(doc(db, "users", user.uid));
  if (!perfil.exists() || !perfil.data().profileComplete) {
    setTexto("#estado", "Finalize seu perfil para poder entrar no grupo. Depois, abra o link do convite novamente.");
    setTimeout(() => location.replace("perfil.html"), 2500);
  } else {
    const jaMembro = await getDoc(doc(db, "groups", idGrupo))
      .then((s) => s.exists() && s.data().members.includes(user.uid))
      .catch(() => false);
    if (jaMembro) {
      location.replace(`grupo.html?id=${encodeURIComponent(idGrupo)}`);
      await parar();
    }
    setTexto("#estado", "Convite válido. Confirme para entrar no grupo.");
    btn.classList.remove("d-none");
  }
}

btn.addEventListener("click", async () => {
  carregando(btn, true, "Entrando...");
  try {
    const lote = writeBatch(db);
    lote.set(doc(db, "groups", idGrupo, "joins", user.uid), { code: codigo, at: serverTimestamp() });
    lote.update(doc(db, "groups", idGrupo), {
      members: arrayUnion(user.uid),
      memberCount: increment(1)
    });
    await lote.commit();
    location.replace(`grupo.html?id=${encodeURIComponent(idGrupo)}`);
  } catch (e) {
    if (e.code === "permission-denied") {
      setTexto("#estado", "Não foi possível entrar: o grupo pode estar cheio ou o código do convite mudou.");
      toast("Convite inválido ou grupo cheio.", "err");
    } else {
      erro(e, "Não foi possível entrar no grupo.");
    }
    carregando(btn, false);
  }
});
