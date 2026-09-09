// Utilidades de interface compartilhadas

const CHAVE_TEMA = "ph-theme";

export function aplicarTema(tema) {
  document.documentElement.setAttribute("data-bs-theme", tema);
  try { localStorage.setItem(CHAVE_TEMA, tema); } catch (e) { /* preferência apenas local */ }
  const btn = document.querySelector("[data-ph-theme-toggle]");
  if (btn) {
    btn.setAttribute("aria-label", tema === "dark" ? "Ativar modo claro" : "Ativar modo escuro");
    btn.innerHTML = `<i data-lucide="${tema === "dark" ? "sun" : "moon"}" aria-hidden="true"></i>`;
    icones();
  }
}

export function temaAtual() {
  return document.documentElement.getAttribute("data-bs-theme") === "light" ? "light" : "dark";
}

export function iniciarTema() {
  aplicarTema(temaAtual());
  document.querySelectorAll("[data-ph-theme-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => aplicarTema(temaAtual() === "dark" ? "light" : "dark"));
  });
}

export function icones() {
  if (window.lucide) window.lucide.createIcons();
}

export function toast(mensagem, tipo = "info", ms = 4200) {
  let area = document.getElementById("ph-toasts");
  if (!area) {
    area = document.createElement("div");
    area.id = "ph-toasts";
    document.body.appendChild(area);
  }
  const el = document.createElement("div");
  el.className = `ph-toast ph-toast--${tipo}`;
  el.setAttribute("role", tipo === "err" ? "alert" : "status");
  el.textContent = mensagem;
  area.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

export function setTexto(seletor, texto) {
  const el = typeof seletor === "string" ? document.querySelector(seletor) : seletor;
  if (el) el.textContent = texto ?? "";
}

export function carregando(botao, ativo, textoOcupado = "Aguarde...") {
  if (!botao) return;
  if (ativo) {
    botao.dataset.phConteudo = botao.innerHTML;
    botao.disabled = true;
    botao.textContent = textoOcupado;
  } else {
    botao.disabled = false;
    if (botao.dataset.phConteudo !== undefined) {
      botao.innerHTML = botao.dataset.phConteudo;
      icones();
    }
  }
}

export function pronto() {
  document.body.classList.remove("ph-loading");
}

const MENSAGENS = {
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/missing-email": "Informe o e-mail.",
  "auth/user-disabled": "Esta conta está desativada.",
  "auth/user-not-found": "E-mail ou senha incorretos.",
  "auth/wrong-password": "E-mail ou senha incorretos.",
  "auth/invalid-credential": "E-mail ou senha incorretos.",
  "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
  "auth/email-already-in-use": "Este e-mail já possui cadastro.",
  "auth/weak-password": "Senha fraca. Use pelo menos 8 caracteres.",
  "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
  "auth/network-request-failed": "Falha de conexão. Verifique sua internet.",
  "auth/requires-recent-login": "Por segurança, entre novamente para concluir esta ação.",
  "auth/popup-closed-by-user": "A janela do Google foi fechada antes de concluir.",
  "auth/popup-blocked": "O navegador bloqueou a janela do Google. Libere os pop-ups e tente de novo.",
  "auth/cancelled-popup-request": "Outra janela de login já estava aberta.",
  "auth/account-exists-with-different-credential": "Este e-mail já está cadastrado com outra forma de login.",
  "auth/operation-not-allowed": "Este método de login não está habilitado no projeto.",
  "auth/invalid-verification-code": "Código inválido. Confira o aplicativo autenticador.",
  "auth/totp-challenge-timeout": "Tempo esgotado. Refaça o login.",
  "auth/unsupported-first-factor": "Não é possível ativar 2FA nesta conta.",
  "auth/second-factor-already-in-use": "Este segundo fator já está cadastrado.",
  "auth/maximum-second-factor-count-exceeded": "Limite de segundos fatores atingido.",
  "permission-denied": "Operação não autorizada.",
  "unavailable": "Sem conexão com o servidor. Tente novamente.",
  "not-found": "Registro não encontrado.",
  "already-exists": "Este registro já existe."
};

export function mensagemErro(erro, padrao = "Não foi possível concluir a operação.") {
  const codigo = erro && erro.code ? String(erro.code) : "";
  if (MENSAGENS[codigo]) return MENSAGENS[codigo];
  if (codigo) console.warn("[Placeholder]", codigo, erro.message || "");
  else console.warn("[Placeholder]", erro);
  return padrao;
}

export function erro(e, padrao) {
  toast(mensagemErro(e, padrao), "err");
}

export function tempoRelativo(data) {
  if (!data) return "";
  const seg = Math.floor((Date.now() - data.getTime()) / 1000);
  if (seg < 60) return "agora";
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  return data.toLocaleDateString("pt-BR");
}

export function limparTexto(valor, max = 500) {
  return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
