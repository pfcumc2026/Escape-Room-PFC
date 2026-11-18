// Cliente HTTP da API REST: envia o JWT da sessão e converte as respostas de erro

import { API_URL } from "../config.js";
import { ErroApp } from "./ErroApp.js";

// Erro devolvido pela API: a mensagem já vem pronta para o usuário e o código é estável
export class ErroApi extends ErroApp {
  constructor(status, codigo, mensagem) {
    super(mensagem, { duracao: 6000 });
    this.name = "ErroApi";
    this.status = status;
    this.code = codigo;
  }
}

export class Api {
  // O JWT fica no localStorage para a sessão sobreviver entre abas; ele expira em poucas horas
  // e todo conteúdo dos usuários é inserido com textContent, reduzindo o risco de XSS
  static CHAVE_SESSAO = "escape-sessao";

  static get token() {
    try { return localStorage.getItem(Api.CHAVE_SESSAO); } catch { return null; }
  }

  static guardarToken(token) {
    try { localStorage.setItem(Api.CHAVE_SESSAO, token); } catch { /* navegação privada */ }
  }

  static esquecerToken() {
    try { localStorage.removeItem(Api.CHAVE_SESSAO); } catch { /* navegação privada */ }
  }

  static url(caminho) {
    return `${API_URL}${caminho}`;
  }

  static async requisitar(metodo, caminho, corpo) {
    const cabecalhos = {};
    if (corpo !== undefined) cabecalhos["Content-Type"] = "application/json";
    if (Api.token) cabecalhos.Authorization = `Bearer ${Api.token}`;

    let resposta;
    try {
      resposta = await fetch(Api.url(caminho), {
        method: metodo,
        headers: cabecalhos,
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined
      });
    } catch {
      throw new ErroApi(0, "SEM_CONEXAO", "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
    }

    if (resposta.status === 204) return null;
    const dados = await resposta.json().catch(() => null);
    if (resposta.ok) return dados;

    const erro = dados?.erro || {};
    if (resposta.status === 401 && erro.codigo === "TOKEN_INVALIDO") Api.esquecerToken();
    throw new ErroApi(resposta.status, erro.codigo || "ERRO", erro.mensagem || "Não foi possível concluir a operação.");
  }

  static get(caminho) { return Api.requisitar("GET", caminho); }
  static post(caminho, corpo = {}) { return Api.requisitar("POST", caminho, corpo); }
  static put(caminho, corpo) { return Api.requisitar("PUT", caminho, corpo); }
  static patch(caminho, corpo) { return Api.requisitar("PATCH", caminho, corpo); }
  static excluir(caminho, corpo) { return Api.requisitar("DELETE", caminho, corpo); }
}
