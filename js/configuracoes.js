// Configurações: tema, dados, 2FA (TOTP), senha e exclusão de conta

import { auth, db, rtdb, googleProvider } from "./firebase.js";
import {
  multiFactor, TotpMultiFactorGenerator, EmailAuthProvider,
  reauthenticateWithCredential, reauthenticateWithPopup,
  sendPasswordResetEmail, deleteUser
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc, collection, query, where, getDocs, deleteDoc, updateDoc, writeBatch,
  arrayRemove, increment, limit
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { ref, remove } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { exigirAutenticacao, sair } from "./guard.js";
import { icones, toast, erro, carregando, setTexto, aplicarTema, temaAtual } from "./ui.js";

const { user, perfil } = await exigirAutenticacao();
const usaSenha = user.providerData.some((p) => p.providerId === "password");

const switchTema = document.getElementById("switch-tema");
switchTema.checked = temaAtual() === "dark";
switchTema.addEventListener("change", () => aplicarTema(switchTema.checked ? "dark" : "light"));

// Dados da conta
const dados = [
  ["Username", perfil.username],
  ["E-mail", user.email || "—"],
  ["Forma de login", user.providerData.map((p) => (p.providerId === "google.com" ? "Google" : "E-mail e senha")).join(", ")],
  ["Conta criada em", new Date(user.metadata.creationTime).toLocaleString("pt-BR")]
];
const areaDados = document.getElementById("meus-dados");
dados.forEach(([rotulo, valor]) => {
  const item = document.createElement("div");
  item.className = "ph-item";
  const main = document.createElement("div");
  main.className = "ph-item__main";
  const t = document.createElement("div");
  t.className = "ph-item__meta";
  t.textContent = rotulo;
  const v = document.createElement("div");
  v.className = "ph-item__name";
  v.textContent = valor;
  main.append(t, v);
  item.appendChild(main);
  areaDados.appendChild(item);
});

// Reautenticação
async function reautenticar() {
  if (!usaSenha) { await reauthenticateWithPopup(user, googleProvider); return; }
  const senha = prompt("Por segurança, digite sua senha para continuar:");
  if (!senha) throw new Error("cancelado");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, senha));
}

// 2FA (TOTP)
const mfa = multiFactor(user);
const fluxo = document.getElementById("fluxo-2fa");
const btnAtivar = document.getElementById("btn-ativar-2fa");
const btnDesativar = document.getElementById("btn-desativar-2fa");
let segredo = null;

function estado2fa() {
  const ativo = mfa.enrolledFactors.length > 0;
  document.getElementById("dot-2fa").classList.toggle("ph-dot--on", ativo);
  setTexto("#titulo-2fa", ativo ? "2FA ativo" : "2FA desativado");
  setTexto("#detalhe-2fa", ativo
    ? "O login pedirá um código do aplicativo autenticador."
    : "Sua conta é protegida apenas pela senha.");
  btnAtivar.classList.toggle("d-none", ativo);
  btnDesativar.classList.toggle("d-none", !ativo);
}
estado2fa();

btnAtivar.addEventListener("click", async () => {
  carregando(btnAtivar, true, "Preparando...");
  try {
    let sessao;
    try {
      sessao = await mfa.getSession();
    } catch (e) {
      if (e.code !== "auth/requires-recent-login") throw e;
      await reautenticar();
      sessao = await mfa.getSession();
    }
    segredo = await TotpMultiFactorGenerator.generateSecret(sessao);
    const uri = segredo.generateQrCodeUrl(user.email || perfil.username, "Placeholder");
    const alvo = document.getElementById("qr-2fa");
    alvo.textContent = "";
    if (window.QRCode) {
      new QRCode(alvo, {
        text: uri, width: 190, height: 190,
        colorDark: temaAtual() === "dark" ? "#e6ebf2" : "#10161f",
        colorLight: temaAtual() === "dark" ? "#121721" : "#ffffff"
      });
    }
    setTexto("#chave-2fa", segredo.secretKey);
    fluxo.classList.remove("d-none");
  } catch (e) {
    if (e.message !== "cancelado") erro(e, "Não foi possível iniciar a ativação do 2FA.");
  }
  carregando(btnAtivar, false);
});

document.getElementById("btn-confirmar-2fa").addEventListener("click", async (ev) => {
  const alvoBotao = ev.currentTarget;
  if (!segredo) return;
  const codigo = document.getElementById("codigo-2fa").value.replace(/\D/g, "");
  if (codigo.length !== 6) { toast("Digite os 6 dígitos gerados pelo aplicativo.", "err"); return; }
  carregando(alvoBotao, true, "Confirmando...");
  try {
    const assercao = TotpMultiFactorGenerator.assertionForEnrollment(segredo, codigo);
    await mfa.enroll(assercao, "Aplicativo autenticador");
    segredo = null;
    fluxo.classList.add("d-none");
    document.getElementById("codigo-2fa").value = "";
    estado2fa();
    toast("2FA ativado.", "ok");
  } catch (e) {
    erro(e, "Código inválido. Tente novamente.");
  }
  carregando(alvoBotao, false);
});

document.getElementById("btn-cancelar-2fa").addEventListener("click", () => {
  segredo = null;
  fluxo.classList.add("d-none");
});

btnDesativar.addEventListener("click", async () => {
  if (!confirm("Desativar a verificação em duas etapas?")) return;
  carregando(btnDesativar, true, "Desativando...");
  try {
    try {
      await mfa.unenroll(mfa.enrolledFactors[0]);
    } catch (e) {
      if (e.code !== "auth/requires-recent-login") throw e;
      await reautenticar();
      await mfa.unenroll(mfa.enrolledFactors[0]);
    }
    estado2fa();
    toast("2FA desativado.", "ok");
  } catch (e) {
    if (e.message !== "cancelado") erro(e, "Não foi possível desativar o 2FA.");
  }
  carregando(btnDesativar, false);
});

// Senha
const btnSenha = document.getElementById("btn-trocar-senha");
if (!usaSenha) {
  btnSenha.disabled = true;
  setTexto("#aviso-senha", "Sua conta entra pelo Google, então a senha é gerenciada pela própria conta Google.");
}
btnSenha.addEventListener("click", async () => {
  carregando(btnSenha, true, "Enviando...");
  try {
    await sendPasswordResetEmail(auth, user.email);
    toast("Link de troca de senha enviado para o seu e-mail.", "ok");
  } catch (e) {
    erro(e, "Não foi possível enviar o link.");
  }
  carregando(btnSenha, false);
});

document.getElementById("btn-sair").addEventListener("click", sair);

// Exclusão da conta
setTexto("#username-esperado", perfil.username);
const modalExcluir = new bootstrap.Modal(document.getElementById("modal-excluir"));
document.getElementById("btn-excluir").addEventListener("click", () => modalExcluir.show());

document.getElementById("btn-confirmar-exclusao").addEventListener("click", async (ev) => {
  const alvoBotao = ev.currentTarget;
  const digitado = document.getElementById("confirma-username").value.trim();
  if (digitado.toLowerCase() !== perfil.usernameLower) {
    toast("O username digitado não corresponde à sua conta.", "err");
    return;
  }
  if (!confirm("Esta ação é permanente e apagará seus dados. Deseja excluir sua conta agora?")) return;

  carregando(alvoBotao, true, "Excluindo...");
  try {
    await limparDados();
    try {
      await deleteUser(user);
    } catch (e) {
      if (e.code !== "auth/requires-recent-login") throw e;
      await reautenticar();
      await deleteUser(user);
    }
    location.replace("login.html");
  } catch (e) {
    if (e.message !== "cancelado") erro(e, "Não foi possível excluir a conta.");
    carregando(alvoBotao, false);
  }
});

async function limparDados() {
  const grupos = await getDocs(query(collection(db, "groups"), where("members", "array-contains", user.uid)));
  for (const g of grupos.docs) {
    const dados = g.data();
    if (dados.ownerId !== user.uid) {
      await updateDoc(g.ref, { members: arrayRemove(user.uid), memberCount: increment(-1) });
      continue;
    }
    const restantes = dados.members.filter((uid) => uid !== user.uid);
    if (restantes.length) {
      await updateDoc(g.ref, { ownerId: restantes[0], members: arrayRemove(user.uid), memberCount: increment(-1) });
      continue;
    }
    const msgs = await getDocs(query(collection(db, "groups", g.id, "messages"), limit(300)));
    for (let i = 0; i < msgs.docs.length; i += 200) {
      const lote = writeBatch(db);
      msgs.docs.slice(i, i + 200).forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }
    await deleteDoc(doc(db, "groups", g.id, "rate", user.uid)).catch(() => {});
    await deleteDoc(g.ref);
  }

  await remove(ref(rtdb, `status/${user.uid}`)).catch(() => {});
  await deleteDoc(doc(db, "users", user.uid, "private", "profile")).catch(() => {});
  await deleteDoc(doc(db, "usernames", perfil.usernameLower)).catch(() => {});
  await deleteDoc(doc(db, "users", user.uid));
}

icones();
