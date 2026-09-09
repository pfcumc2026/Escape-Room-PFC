// Painel: perfil resumido, grupos e acesso às configurações

import { db, avatarUrl } from "./firebase.js";
import {
  collection, doc, query, where, onSnapshot, writeBatch, serverTimestamp, getDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { exigirAutenticacao, sair } from "./guard.js";
import { iniciarPresenca } from "./presenca.js";
import { icones, toast, erro, carregando, setTexto, limparTexto, aplicarTema, temaAtual } from "./ui.js";

const { user, perfil } = await exigirAutenticacao();
iniciarPresenca(user.uid);

document.getElementById("avatar").src = avatarUrl(perfil.avatarStyle, perfil.avatarSeed);
setTexto("#username", perfil.username);
getDoc(doc(db, "users", user.uid, "private", "profile"))
  .then((s) => setTexto("#nome", s.exists() ? s.data().name : ""))
  .catch(() => {});

const switchTema = document.getElementById("switch-tema");
switchTema.checked = temaAtual() === "dark";
switchTema.addEventListener("change", () => aplicarTema(switchTema.checked ? "dark" : "light"));

document.getElementById("btn-sair").addEventListener("click", sair);
document.getElementById("btn-sair-modal").addEventListener("click", sair);
document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => new bootstrap.Tooltip(el));

// Grupos
const listaGrupos = document.getElementById("lista-grupos");

onSnapshot(
  query(collection(db, "groups"), where("members", "array-contains", user.uid)),
  (snap) => {
    listaGrupos.textContent = "";
    if (snap.empty) {
      const vazio = document.createElement("div");
      vazio.className = "ph-empty";
      vazio.textContent = "Você ainda não participa de nenhum grupo.";
      listaGrupos.appendChild(vazio);
      return;
    }
    snap.docs
      .sort((a, b) => (b.data().createdAt?.seconds || 0) - (a.data().createdAt?.seconds || 0))
      .forEach((d) => {
        const g = d.data();
        const item = document.createElement("div");
        item.className = "ph-item";

        const main = document.createElement("div");
        main.className = "ph-item__main";
        const nome = document.createElement("div");
        nome.className = "ph-item__name";
        nome.textContent = g.name;
        const meta = document.createElement("div");
        meta.className = "ph-item__meta";
        meta.textContent = `${g.memberCount} jogadores · ${g.ownerId === user.uid ? "você é o proprietário" : "integrante"}`;
        main.append(nome, meta);

        const link = document.createElement("a");
        link.className = "btn btn-outline-secondary btn-sm";
        link.href = `grupo.html?id=${encodeURIComponent(d.id)}`;
        link.textContent = "Abrir";

        item.append(main, link);
        listaGrupos.appendChild(item);
      });
  },
  (e) => erro(e, "Não foi possível carregar seus grupos.")
);

// Criar grupo
const formGrupo = document.getElementById("form-grupo");
const btnCriar = document.getElementById("btn-criar-grupo");

formGrupo.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const nome = limparTexto(document.getElementById("nome-grupo").value, 30);
  if (nome.length < 3) { toast("O nome do grupo precisa ter ao menos 3 caracteres.", "err"); return; }

  carregando(btnCriar, true, "Criando...");
  try {
    const ref = doc(collection(db, "groups"));
    const lote = writeBatch(db);
    lote.set(ref, {
      name: nome,
      ownerId: user.uid,
      members: [user.uid],
      memberCount: 1,
      createdAt: serverTimestamp()
    });
    lote.update(doc(db, "users", user.uid), { lastGroupAt: serverTimestamp() });
    await lote.commit();
    bootstrap.Modal.getInstance(document.getElementById("modal-grupo")).hide();
    formGrupo.reset();
    location.href = `grupo.html?id=${encodeURIComponent(ref.id)}`;
  } catch (e) {
    if (e.code === "permission-denied") toast("Aguarde alguns segundos antes de criar outro grupo.", "err");
    else erro(e, "Não foi possível criar o grupo.");
    carregando(btnCriar, false);
  }
});

icones();
