// Mensagem do chat do grupo (GET /api/groups/{id}/messages)

import { Texto } from "../nucleo/Texto.js";

export class Mensagem {
  constructor(dados = {}) {
    this.uid = dados.uid || "";
    this.username = dados.username || "";
    this.text = dados.text || "";
    this.createdAt = dados.createdAt || null;
    this.expiresAt = dados.expiresAt || null;
  }

  static deDados(dados) {
    return new Mensagem(dados);
  }

  get data() {
    return this.createdAt ? new Date(this.createdAt) : new Date();
  }

  valida(agora) {
    return !!this.expiresAt && this.expiresAt > agora;
  }

  recente(agora) {
    return agora - this.data.getTime() < 60000;
  }

  ehDe(uid) {
    return this.uid === uid;
  }

  get cabecalho() {
    return `${this.username} · ${Texto.tempoRelativo(this.data)}`;
  }
}
