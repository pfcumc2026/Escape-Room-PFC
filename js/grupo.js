// Grupo: integrantes, presença, convites, link/QR Code e chat

import { db, LIMITES, avatarUrl } from "./firebase.js";
import {
  doc, collection, query, where, orderBy, limit, onSnapshot, getDoc, getDocs,
  setDoc, deleteDoc, updateDoc, writeBatch, serverTimestamp, arrayRemove,
  increment, Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { exigirAutenticacao } from "./guard.js";
import { iniciarPresenca, observarPresenca } from "./presenca.js";
import { icones, toast, erro, carregando, setTexto, limparTexto, tempoRelativo, temaAtual } from "./ui.js";

const { user, perfil } = await exigirAutenticacao();
iniciarPresenca(user.uid);

const idGrupo = new URLSearchParams(location.search).get("id") || "";
if (!/^[A-Za-z0-9_-]{6,40}$/.test(idGrupo)) {
  location.replace("dashboard.html");
  await new Promise(() => {});
}

const refGrupo = doc(db, "groups", idGrupo);
const listaIntegrantes = document.getElementById("lista-integrantes");
const acoes = document.getElementById("acoes-grupo");
const blocoConvites = document.getElementById("bloco-convites");

let grupo = null;
let ehProprietario = false;
let cancelarPresenca = [];
let assinaturaChat = null;
let assinaturaPendentes = null;

onSnapshot(refGrupo, (snap) => {
  if (!snap.exists()) {
    toast("Este grupo não existe mais.", "err");
    setTimeout(() => location.replace("dashboard.html"), 1200);
    return;
  }
  grupo = snap.data();
  if (!grupo.members.includes(user.uid)) {
    toast("Você não faz parte deste grupo.", "err");
    setTimeout(() => location.replace("dashboard.html"), 1200);
    return;
  }
  ehProprietario = grupo.ownerId === user.uid;

  setTexto("#nome-grupo", grupo.name);
  setTexto("#contagem", String(grupo.memberCount));
  setTexto("#papel", ehProprietario ? "você é o proprietário" : "integrante");
  blocoConvites.classList.toggle("d-none", !ehProprietario);

  desenharAcoes();
  desenharIntegrantes();
  if (ehProprietario && !assinaturaPendentes) ouvirPendentes();
  if (!assinaturaChat) ouvirChat();
}, (e) => {
  erro(e, "Não foi possível abrir o grupo.");
  setTimeout(() => location.replace("dashboard.html"), 1500);
});

// Ações do topo
function desenharAcoes() {
  acoes.textContent = "";
  if (ehProprietario) {
    acoes.appendChild(botao("Convite e QR Code", "qr-code", "btn-primary", abrirConvite));
    acoes.appendChild(botao("Excluir grupo", "trash-2", "btn-outline-secondary", excluirGrupo));
  } else {
    acoes.appendChild(botao("Sair do grupo", "log-out", "btn-outline-secondary", sairDoGrupo));
  }
  icones();
}

function botao(texto, icone, classe, aoClicar) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `btn ${classe} btn-sm d-inline-flex align-items-center gap-2`;
  const i = document.createElement("i");
  i.setAttribute("data-lucide", icone);
  i.setAttribute("aria-hidden", "true");
  b.append(i, document.createTextNode(texto));
  b.addEventListener("click", () => aoClicar(b));
  return b;
}

// Integrantes
async function desenharIntegrantes() {
  cancelarPresenca.forEach((f) => f());
  cancelarPresenca = [];
  listaIntegrantes.textContent = "";

  for (const uid of grupo.members) {
    const item = document.createElement("div");
    item.className = "ph-item";

    const img = document.createElement("img");
    img.className = "ph-avatar ph-avatar--sm";
    img.alt = "";

    const main = document.createElement("div");
    main.className = "ph-item__main";
    const nome = document.createElement("div");
    nome.className = "ph-item__name";
    nome.textContent = uid === user.uid ? perfil.username : "carregando…";
    const meta = document.createElement("div");
    meta.className = "ph-item__meta d-flex align-items-center gap-2";
    const ponto = document.createElement("span");
    ponto.className = "ph-dot";
    const estado = document.createElement("span");
    estado.textContent = "offline";
    meta.append(ponto, estado, document.createTextNode(uid === grupo.ownerId ? "· proprietário" : ""));
    main.append(nome, meta);

    item.append(img, main);

    if (ehProprietario && uid !== user.uid) {
      item.appendChild(botao("Remover", "user-minus", "btn-outline-secondary", (b) => removerIntegrante(uid, b)));
    }
    listaIntegrantes.appendChild(item);

    if (uid === user.uid) {
      img.src = avatarUrl(perfil.avatarStyle, perfil.avatarSeed);
    } else {
      getDoc(doc(db, "users", uid)).then((s) => {
        if (!s.exists()) { nome.textContent = "usuário removido"; return; }
        nome.textContent = s.data().username;
        img.src = avatarUrl(s.data().avatarStyle, s.data().avatarSeed);
      }).catch(() => { nome.textContent = "indisponível"; });
    }

    cancelarPresenca.push(observarPresenca(uid, (online) => {
      ponto.classList.toggle("ph-dot--on", online);
      estado.textContent = online ? "online" : "offline";
    }));
  }
  icones();
}

async function removerIntegrante(uid, botaoRef) {
  carregando(botaoRef, true, "...");
  try {
    await updateDoc(refGrupo, { members: arrayRemove(uid), memberCount: increment(-1) });
    toast("Integrante removido.", "ok");
  } catch (e) {
    erro(e, "Não foi possível remover o integrante.");
  }
  carregando(botaoRef, false);
}

async function sairDoGrupo(botaoRef) {
  if (!confirm("Deseja realmente sair deste grupo?")) return;
  carregando(botaoRef, true, "Saindo...");
  try {
    await updateDoc(refGrupo, { members: arrayRemove(user.uid), memberCount: increment(-1) });
    location.replace("dashboard.html");
  } catch (e) {
    erro(e, "Não foi possível sair do grupo.");
    carregando(botaoRef, false);
  }
}

async function excluirGrupo(botaoRef) {
  if (!confirm("Excluir o grupo apaga o chat e remove todos os integrantes. Continuar?")) return;
  carregando(botaoRef, true, "Excluindo...");
  try {
    const msgs = await getDocs(query(collection(db, "groups", idGrupo, "messages"), limit(300)));
    for (let i = 0; i < msgs.docs.length; i += 200) {
      const lote = writeBatch(db);
      msgs.docs.slice(i, i + 200).forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }
    const convites = await getDocs(query(collection(db, "invites"),
      where("groupId", "==", idGrupo), where("fromUid", "==", user.uid)));
    const loteConvites = writeBatch(db);
    convites.docs.forEach((d) => loteConvites.delete(d.ref));
    for (const uid of grupo.members) {
      loteConvites.delete(doc(db, "groups", idGrupo, "rate", uid));
      loteConvites.delete(doc(db, "groups", idGrupo, "joins", uid));
    }
    await loteConvites.commit();
    await deleteDoc(refGrupo);
    location.replace("dashboard.html");
  } catch (e) {
    erro(e, "Não foi possível excluir o grupo.");
    carregando(botaoRef, false);
  }
}

// Convites
document.getElementById("form-convite").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = document.getElementById("btn-convidar");
  const campo = document.getElementById("convidado");
  const alvo = limparTexto(campo.value, LIMITES.usernameMax).replace(/\s/g, "").toLowerCase();

  if (!/^[a-z0-9_]{3,20}$/.test(alvo)) { toast("Username inválido.", "err"); return; }
  if (alvo === perfil.usernameLower) { toast("Você já faz parte do grupo.", "err"); return; }
  if (grupo.memberCount >= LIMITES.maxIntegrantes) { toast("O grupo já está cheio.", "err"); return; }

  carregando(btn, true, "Enviando...");
  try {
    const mapa = await getDoc(doc(db, "usernames", alvo));
    if (!mapa.exists()) { toast("Usuário não encontrado.", "err"); carregando(btn, false); return; }
    const uidAlvo = mapa.data().uid;
    if (grupo.members.includes(uidAlvo)) { toast("Este usuário já está no grupo.", "err"); carregando(btn, false); return; }

    const perfilAlvo = await getDoc(doc(db, "users", uidAlvo));
    const idConvite = `${idGrupo}_${uidAlvo}`;
    const existente = await getDoc(doc(db, "invites", idConvite));
    if (existente.exists()) {
      if (existente.data().status === "pending") {
        toast("Já existe um convite pendente para este usuário.", "info");
        carregando(btn, false);
        return;
      }
      await deleteDoc(doc(db, "invites", idConvite));
    }

    await setDoc(doc(db, "invites", idConvite), {
      groupId: idGrupo,
      groupName: grupo.name,
      fromUid: user.uid,
      fromUsername: perfil.username,
      toUid: uidAlvo,
      toUsername: perfilAlvo.exists() ? perfilAlvo.data().username : alvo,
      status: "pending",
      createdAt: serverTimestamp()
    });
    campo.value = "";
    toast("Convite enviado.", "ok");
  } catch (e) {
    if (e.code === "permission-denied") toast("Convite não permitido: verifique o limite de jogadores.", "err");
    else erro(e, "Não foi possível enviar o convite.");
  }
  carregando(btn, false);
});

function ouvirPendentes() {
  const lista = document.getElementById("lista-pendentes");
  assinaturaPendentes = onSnapshot(
    query(collection(db, "invites"),
      where("groupId", "==", idGrupo),
      where("fromUid", "==", user.uid),
      where("status", "==", "pending")),
    (snap) => {
      lista.textContent = "";
      snap.docs.forEach((d) => {
        const c = d.data();
        const item = document.createElement("div");
        item.className = "ph-item";
        const main = document.createElement("div");
        main.className = "ph-item__main";
        const nome = document.createElement("div");
        nome.className = "ph-item__name";
        nome.textContent = c.toUsername;
        const meta = document.createElement("div");
        meta.className = "ph-item__meta";
        meta.textContent = "convite pendente";
        main.append(nome, meta);
        const cancelar = document.createElement("button");
        cancelar.className = "btn btn-outline-secondary btn-sm";
        cancelar.textContent = "Cancelar";
        cancelar.addEventListener("click", async () => {
          try { await deleteDoc(d.ref); } catch (e) { erro(e, "Não foi possível cancelar."); }
        });
        item.append(main, cancelar);
        lista.appendChild(item);
      });
    },
    () => {}
  );
}

// Link e QR Code
function linkConvite() {
  const url = new URL("entrar.html", location.href);
  url.searchParams.set("g", idGrupo);
  url.searchParams.set("c", grupo.inviteCode);
  return url.href;
}

function abrirConvite() {
  const campo = document.getElementById("link-convite");
  campo.value = linkConvite();
  desenharQr();
  new bootstrap.Modal(document.getElementById("modal-convite")).show();
}

function desenharQr() {
  const alvo = document.getElementById("qrcode");
  alvo.textContent = "";
  if (!window.QRCode) { alvo.textContent = "QR Code indisponível."; return; }
  new QRCode(alvo, {
    text: linkConvite(),
    width: 190,
    height: 190,
    colorDark: temaAtual() === "dark" ? "#e6ebf2" : "#10161f",
    colorLight: temaAtual() === "dark" ? "#121721" : "#ffffff"
  });
}

document.getElementById("btn-copiar").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(linkConvite());
    toast("Link copiado.", "ok");
  } catch {
    document.getElementById("link-convite").select();
    toast("Copie o link selecionado.", "info");
  }
});

document.getElementById("btn-novo-codigo").addEventListener("click", async (ev) => {
  const alvoBotao = ev.currentTarget;
  carregando(alvoBotao, true, "Gerando...");
  try {
    const alfabeto = "abcdefghijkmnpqrstuvwxyz23456789";
    const valores = crypto.getRandomValues(new Uint8Array(8));
    const codigo = Array.from(valores, (v) => alfabeto[v % alfabeto.length]).join("");
    await updateDoc(refGrupo, { inviteCode: codigo });
    grupo.inviteCode = codigo;
    document.getElementById("link-convite").value = linkConvite();
    desenharQr();
    toast("Novo código gerado. O link anterior deixou de valer.", "ok");
  } catch (e) {
    erro(e, "Não foi possível gerar um novo código.");
  }
  carregando(alvoBotao, false);
});

// Chat
const chat = document.getElementById("chat");
const formMsg = document.getElementById("form-msg");
const campoMsg = document.getElementById("campo-msg");

function ouvirChat() {
  assinaturaChat = onSnapshot(
    query(collection(db, "groups", idGrupo, "messages"), orderBy("createdAt", "desc"), limit(60)),
    (snap) => {
      const agora = Date.now();
      const mensagens = snap.docs
        .map((d) => d.data())
        .filter((m) => m.expiresAt && m.expiresAt.toMillis() > agora)
        .reverse();

      chat.textContent = "";
      if (!mensagens.length) {
        const vazio = document.createElement("div");
        vazio.className = "ph-empty";
        vazio.textContent = "Nenhuma mensagem nas últimas 24 horas.";
        chat.appendChild(vazio);
        return;
      }
      mensagens.forEach((m) => {
        const data = m.createdAt ? m.createdAt.toDate() : new Date();
        const recente = agora - data.getTime() < 60000;
        const bloco = document.createElement("div");
        bloco.className = `ph-msg ${m.uid === user.uid ? "ph-msg--own" : ""} ${recente ? "ph-msg--new" : ""}`;
        const cabecalho = document.createElement("div");
        cabecalho.className = "ph-msg__head";
        cabecalho.textContent = `${m.username} · ${tempoRelativo(data)}`;
        const corpo = document.createElement("div");
        corpo.className = "ph-msg__body";
        corpo.textContent = m.text;
        bloco.append(cabecalho, corpo);
        chat.appendChild(bloco);
      });
      chat.scrollTop = chat.scrollHeight;
    },
    (e) => erro(e, "Não foi possível carregar o chat.")
  );
}

formMsg.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const btn = document.getElementById("btn-msg");
  const texto = limparTexto(campoMsg.value, LIMITES.mensagemMax);
  if (!texto) return;

  carregando(btn, true, "…");
  try {
    const refRate = doc(db, "groups", idGrupo, "rate", user.uid);
    const atual = await getDoc(refRate);
    const agora = Date.now();
    let rate;

    if (!atual.exists()) {
      rate = { windowStart: serverTimestamp(), count: 1, lastAt: serverTimestamp() };
    } else {
      const d = atual.data();
      const ultimo = d.lastAt ? d.lastAt.toMillis() : 0;
      const inicio = d.windowStart ? d.windowStart.toMillis() : 0;
      if (agora - ultimo < LIMITES.intervaloMinimoSegundos * 1000) {
        toast("Aguarde alguns segundos antes de enviar outra mensagem.", "err");
        carregando(btn, false);
        return;
      }
      if (agora - inicio > LIMITES.janelaSegundos * 1000) {
        rate = { windowStart: serverTimestamp(), count: 1, lastAt: serverTimestamp() };
      } else if (d.count >= LIMITES.mensagensPorJanela) {
        toast("Limite de mensagens atingido. Aguarde um minuto.", "err", 6000);
        carregando(btn, false);
        return;
      } else {
        rate = { windowStart: d.windowStart, count: d.count + 1, lastAt: serverTimestamp() };
      }
    }

    const lote = writeBatch(db);
    lote.set(refRate, rate);
    lote.set(doc(collection(db, "groups", idGrupo, "messages")), {
      uid: user.uid,
      username: perfil.username,
      text: texto,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(agora + LIMITES.horasValidadeMensagem * 3600 * 1000)
    });
    await lote.commit();
    campoMsg.value = "";
  } catch (e) {
    if (e.code === "permission-denied") toast("Mensagem bloqueada pelo limite de envio.", "err");
    else erro(e, "Não foi possível enviar a mensagem.");
  }
  carregando(btn, false);
});

icones();
