// Mensagem do chat (groups/{gid}/messages/{mid})

import { Texto } from "../nucleo/Texto.js";

export class Mensagem {
  constructor(dados = {}) {
    this.uid = dados.uid || "";
    this.username = dados.username || "";
    this.text = dados.text || "";
    this.createdAt = dados.createdAt || null;
    this.expiresAt = dados.expiresAt || null;
  }

  static deSnapshot(snap) {
    return new Mensagem(snap.data());
  }

  get data() {
    return this.createdAt ? this.createdAt.toDate() : new Date();
  }

  valida(agora) {
    return !!this.expiresAt && this.expiresAt.toMillis() > agora;
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
