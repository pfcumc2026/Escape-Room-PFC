// Configuração e edição do perfil (username + avatar DiceBear)

import { db, LIMITES, AVATAR_STYLES, avatarUrl } from "./firebase.js";
import {
  doc, getDoc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { exigirAutenticacao } from "./guard.js";
import { icones, toast, erro, carregando, setTexto, limparTexto } from "./ui.js";

const { user, perfil, perfilCompleto } = await exigirAutenticacao({ exigirPerfil: false });

const campoUsername = document.getElementById("username");
const seletorEstilo = document.getElementById("estilo-avatar");
const opcoes = document.getElementById("opcoes-avatar");
const previa = document.getElementById("avatar-atual");
const statusUsername = document.getElementById("status-username");
const btnSalvar = document.getElementById("btn-salvar");

let estilo = perfil?.avatarStyle || AVATAR_STYLES[0];
let seed = perfil?.avatarSeed || Math.random().toString(36).slice(2, 10);

AVATAR_STYLES.forEach((s) => {
  const op = document.createElement("option");
  op.value = s;
  op.textContent = s;
  seletorEstilo.appendChild(op);
});
seletorEstilo.value = estilo;

if (perfilCompleto) {
  setTexto("#perfil-etapa", "Editar perfil");
  campoUsername.value = perfil.username;
  document.getElementById("link-voltar").classList.remove("d-none");
}

function novasSementes() {
  const base = [seed];
  while (base.length < 6) base.push(Math.random().toString(36).slice(2, 10));
  return base;
}

function desenharOpcoes(sementes) {
  opcoes.textContent = "";
  sementes.forEach((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ph-avatar-pick";
    b.setAttribute("aria-pressed", String(s === seed));
    b.setAttribute("aria-label", `Avatar ${s}`);
    const img = document.createElement("img");
    img.className = "ph-avatar ph-avatar--md";
    img.alt = "";
    img.loading = "lazy";
    img.src = avatarUrl(estilo, s);
    b.appendChild(img);
    b.addEventListener("click", () => { seed = s; atualizar(); desenharOpcoes(sementes); });
    opcoes.appendChild(b);
  });
}

function atualizar() {
  previa.src = avatarUrl(estilo, seed);
  setTexto("#preview-username", campoUsername.value.trim() || "—");
}

let sementes = novasSementes();
desenharOpcoes(sementes);
atualizar();

seletorEstilo.addEventListener("change", () => {
  estilo = seletorEstilo.value;
  desenharOpcoes(sementes);
  atualizar();
});

document.getElementById("btn-sortear").addEventListener("click", () => {
  seed = Math.random().toString(36).slice(2, 10);
  sementes = novasSementes();
  desenharOpcoes(sementes);
  atualizar();
});

campoUsername.addEventListener("input", () => {
  statusUsername.textContent = "";
  atualizar();
});

function problemaNoUsername(valor) {
  if (!valor) return "Informe um username.";
  if (valor.length < LIMITES.usernameMin || valor.length > LIMITES.usernameMax)
    return `Use de ${LIMITES.usernameMin} a ${LIMITES.usernameMax} caracteres.`;
  if (!/^[a-zA-Z0-9_]+$/.test(valor)) return "Use apenas letras, números e underline.";
  return null;
}

campoUsername.addEventListener("blur", async () => {
  const valor = campoUsername.value.trim();
  const problema = problemaNoUsername(valor);
  if (problema) { statusUsername.textContent = problema; statusUsername.style.color = "var(--ph-danger)"; return; }
  if (perfil && valor.toLowerCase() === perfil.usernameLower) { statusUsername.textContent = "Seu username atual."; statusUsername.style.color = "var(--ph-muted)"; return; }
  try {
    const snap = await getDoc(doc(db, "usernames", valor.toLowerCase()));
    const livre = !snap.exists();
    statusUsername.textContent = livre ? "Disponível." : "Este username já está em uso.";
    statusUsername.style.color = livre ? "var(--ph-ok)" : "var(--ph-danger)";
  } catch (e) {
    console.warn("[Placeholder] checagem de username", e);
  }
});

document.getElementById("form-perfil").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const valor = limparTexto(campoUsername.value, LIMITES.usernameMax).replace(/\s/g, "");
  const problema = problemaNoUsername(valor);
  if (problema) { toast(problema, "err"); return; }

  const minusculo = valor.toLowerCase();
  const anterior = perfil?.usernameLower || null;

  carregando(btnSalvar, true, "Salvando...");
  try {
    const lote = writeBatch(db);
    if (minusculo !== anterior) {
      lote.set(doc(db, "usernames", minusculo), { uid: user.uid });
      if (anterior) lote.delete(doc(db, "usernames", anterior));
    }

    const dados = {
      username: valor,
      usernameLower: minusculo,
      avatarStyle: estilo,
      avatarSeed: seed,
      profileComplete: true,
      createdAt: perfil?.createdAt || serverTimestamp()
    };
    if (perfil?.lastGroupAt) dados.lastGroupAt = perfil.lastGroupAt;

    lote.set(doc(db, "users", user.uid), dados);
    lote.set(doc(db, "users", user.uid, "private", "profile"), {
      name: limparTexto(user.displayName || valor, 60)
    });

    await lote.commit();
    toast("Perfil salvo.", "ok");
    setTimeout(() => location.replace("dashboard.html"), 600);
  } catch (e) {
    if (e.code === "permission-denied") toast("Este username já está em uso ou é inválido.", "err");
    else erro(e, "Não foi possível salvar o perfil.");
    carregando(btnSalvar, false);
  }
});

icones();
