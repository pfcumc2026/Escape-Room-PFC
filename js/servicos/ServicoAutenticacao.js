// Autenticação pela API própria: e-mail/senha, verificação de e-mail e recuperação de senha

import { Api } from "../nucleo/Api.js";
import { Usuario } from "../modelos/Usuario.js";

export class ServicoAutenticacao {
  static #atual = null;

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

  async entrarComSenha(email, senha) {
    const resposta = await Api.post("/auth/login", { email, password: senha });
    Api.guardarToken(resposta.token);
    ServicoAutenticacao.#atual = null;
    return new Usuario(resposta.usuario);
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
