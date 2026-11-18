// Autenticação pela API própria: e-mail/senha, Google (OIDC), verificação de e-mail e segundo fator (TOTP)

import { Api } from "../nucleo/Api.js";
import { Usuario } from "../modelos/Usuario.js";

export class ServicoAutenticacao {
  static #atual = null;

  // Etapas devolvidas pelo login: "concluido" traz a sessão; as demais pedem mais um passo
  static ETAPAS = { CONCLUIDO: "concluido", SEGUNDO_FATOR: "2fa", SEGUNDO_FATOR_LEGADO: "2fa-legado", CONFIGURAR_2FA: "configurar-2fa" };

  usuarioAtual({ recarregar = false } = {}) {
    if (!Api.token) return Promise.resolve(null);
    if (recarregar || !ServicoAutenticacao.#atual) {
      ServicoAutenticacao.#atual = Api.get("/users/me")
        .then((dados) => new Usuario(dados))
        .catch((e) => {
          ServicoAutenticacao.#atual = null;
          if (e.status === 401) { Api.esquecerToken(); return null; }
          throw e;
        });
    }
    return ServicoAutenticacao.#atual;
  }

  #resultado(resposta) {
    if (resposta.etapa !== ServicoAutenticacao.ETAPAS.CONCLUIDO) return { etapa: resposta.etapa, desafio: resposta.desafio };
    Api.guardarToken(resposta.token);
    ServicoAutenticacao.#atual = null;
    return { etapa: resposta.etapa, usuario: new Usuario(resposta.usuario), codigosRecuperacao: resposta.recoveryCodes || null };
  }

  async entrarComSenha(email, senha) {
    return this.#resultado(await Api.post("/auth/login", { email, password: senha }));
  }

  // O login com Google acontece no back-end; ao final ele volta para login.html com um código de uso único
  entrarComGoogle(origem = "login") {
    const url = new URL(Api.url("/auth/google"));
    url.searchParams.set("origem", origem);
    const proximo = new URLSearchParams(location.search).get("proximo");
    if (proximo) url.searchParams.set("proximo", proximo);
    location.assign(url.href);
  }

  async concluirGoogle(codigo) {
    return this.#resultado(await Api.post("/auth/google/exchange", { code: codigo }));
  }

  // Aceita o código do aplicativo (6 dígitos) ou um código de recuperação
  async concluirSegundoFator(desafio, codigo) {
    const corpo = /^\d{6}$/.test(codigo) ? { code: codigo } : { recoveryCode: codigo };
    return this.#resultado(await Api.post("/auth/2fa/verify", { challenge: desafio, ...corpo }));
  }

  async concluirSegundoFatorLegado(desafio, codigo) {
    return this.#resultado(await Api.post("/auth/2fa/legacy/verify", { challenge: desafio, code: codigo }));
  }

  prepararNovoAutenticador(desafio) {
    return Api.post("/auth/2fa/migration/setup", { challenge: desafio });
  }

  async ativarNovoAutenticador(desafio, codigo) {
    return this.#resultado(await Api.post("/auth/2fa/migration/enable", { challenge: desafio, code: codigo }));
  }

  async criarConta(nome, email, senha) {
    const resposta = await Api.post("/auth/register", { name: nome, email, password: senha, acceptTerms: true });
    Api.guardarToken(resposta.token);
    ServicoAutenticacao.#atual = null;
    return resposta;
  }

  enviarVerificacao() {
    return Api.post("/auth/email/resend");
  }

  confirmarEmail(token) {
    return Api.post("/auth/email/verify", { token });
  }

  enviarRedefinicaoSenha(email) {
    return Api.post("/auth/password/forgot", { email });
  }

  redefinirSenha(token, senha) {
    return Api.post("/auth/password/reset", { token, password: senha });
  }

  async sair() {
    try {
      if (Api.token) await Api.post("/auth/logout");
    } catch {
      // A sessão local é encerrada mesmo sem resposta do servidor
    } finally {
      Api.esquecerToken();
      ServicoAutenticacao.#atual = null;
    }
  }
}
