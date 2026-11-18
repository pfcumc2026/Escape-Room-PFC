// Atualizações em tempo real por Server-Sent Events: o servidor avisa qual canal mudou
// (grupo, chat, partida, convites, presença) e quem assina o canal busca os dados de novo pela API.
// A leitura usa fetch em vez de EventSource porque o JWT vai no cabeçalho Authorization.

import { Api } from "./Api.js";

export class TempoReal {
  static ESPERA_MAXIMA_MS = 30000;

  constructor() {
    this.assinantes = new Map();
    this.controle = null;
    this.tentativas = 0;
    this.jaConectou = false;
  }

  conectar() {
    if (!this.controle && Api.token) this.#abrir();
  }

  assinar(canal, aoMudar) {
    if (!this.assinantes.has(canal)) this.assinantes.set(canal, new Set());
    this.assinantes.get(canal).add(aoMudar);
    this.conectar();
    return () => this.assinantes.get(canal)?.delete(aoMudar);
  }

  // Carrega os dados agora e de novo a cada aviso; respostas fora de ordem são descartadas
  observar(canais, carregar, aoAtualizar, aoFalhar = () => {}) {
    let ativo = true;
    let versao = 0;
    const atualizar = async () => {
      const minha = ++versao;
      try {
        const dados = await carregar();
        if (ativo && minha === versao) aoAtualizar(dados);
      } catch (e) {
        if (ativo && minha === versao) aoFalhar(e);
      }
    };
    const cancelamentos = [].concat(canais).map((canal) => this.assinar(canal, atualizar));
    atualizar();
    return () => {
      ativo = false;
      cancelamentos.forEach((cancelar) => cancelar());
    };
  }

  async #abrir() {
    this.controle = new AbortController();
    let autorizado = true;
    try {
      const resposta = await fetch(Api.url("/events"), {
        headers: { Authorization: `Bearer ${Api.token}` },
        signal: this.controle.signal
      });
      autorizado = resposta.status !== 401 && resposta.status !== 403;
      if (!resposta.ok) throw new Error(`eventos: ${resposta.status}`);
      this.tentativas = 0;
      await this.#ler(resposta.body.pipeThrough(new TextDecoderStream()).getReader());
    } catch (e) {
      if (e.name === "AbortError") return;
    }
    this.controle = null;
    if (!autorizado) return;
    const espera = Math.min(TempoReal.ESPERA_MAXIMA_MS, 1000 * 2 ** this.tentativas++);
    setTimeout(() => this.conectar(), espera);
  }

  async #ler(leitor) {
    let buffer = "";
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) return;
      buffer += value;
      let fim;
      while ((fim = buffer.indexOf("\n\n")) >= 0) {
        this.#processar(buffer.slice(0, fim));
        buffer = buffer.slice(fim + 2);
      }
    }
  }

  #processar(bloco) {
    const linha = bloco.split("\n").find((l) => l.startsWith("data: "));
    if (!linha) return;
    const { canal } = JSON.parse(linha.slice(6));
    if (canal === "conectado") {
      // Numa reconexão, avisos podem ter se perdido: todos os assinantes recarregam
      if (this.jaConectou) this.assinantes.forEach((lista) => lista.forEach((f) => f()));
      this.jaConectou = true;
      return;
    }
    this.assinantes.get(canal)?.forEach((f) => f());
  }
}

export const tempoReal = new TempoReal();
