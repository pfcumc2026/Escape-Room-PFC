// Tradução dos códigos de erro do Firebase para mensagens do usuário

export class TradutorErros {
  static MENSAGENS = {
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

  static traduzir(erro, padrao = "Não foi possível concluir a operação.") {
    const codigo = erro && erro.code ? String(erro.code) : "";
    if (TradutorErros.MENSAGENS[codigo]) return TradutorErros.MENSAGENS[codigo];
    if (codigo) console.warn("[Placeholder]", codigo, erro.message || "");
    else console.warn("[Placeholder]", erro);
    return padrao;
  }
}
