// Estado compartilhado da partida (GET /api/games/{gid}: partida, pistas encontradas e enigmas resolvidos)

import { Dificuldade } from "./Dificuldade.js";

export class EstadoPartida {
  static STATUS = {
    ESPERA: "WAITING",
    JOGANDO: "PLAYING",
    CONCLUIDA: "COMPLETED",
    FALHOU: "FAILED",
    EXPIRADA: "EXPIRED"
  };

  static TRANSICOES = {
    WAITING: ["PLAYING"],
    PLAYING: ["COMPLETED", "FAILED", "EXPIRED"],
    COMPLETED: [],
    FAILED: [],
    EXPIRED: []
  };

  static MAX_JOGADORES = 3;

  constructor(dados = {}) {
    this.id = dados.id || "";
    this.groupId = dados.groupId || dados.id || "";
    this.ownerId = dados.ownerId || "";
    this.dificuldade = dados.dificuldade || "facil";
    this.semente = dados.semente ?? 0;
    this.status = dados.status || EstadoPartida.STATUS.ESPERA;
    this.jogadores = dados.jogadores || [];
    this.config = dados.config || { ordem: [], enigmas: {}, pistas: {} };
    this.criadaEm = dados.criadaEm ?? null;
    this.iniciadaEm = dados.iniciadaEm ?? null;
    this.expiraEm = dados.expiraEm ?? null;
    this.encerradaEm = dados.encerradaEm ?? null;
    this.pontos = dados.pontos ?? null;
    this.achadas = dados.achadas || {};
    this.resolvidas = dados.resolvidas || {};
  }

  static ms(valor) {
    return valor == null ? null : Number(valor);
  }

  static deDados(id, principal, achadas = {}, resolvidas = {}) {
    return new EstadoPartida({
      id,
      groupId: principal.groupId,
      ownerId: principal.ownerId,
      dificuldade: principal.difficulty,
      semente: principal.seed,
      status: principal.status,
      jogadores: principal.players || [],
      config: principal.config,
      criadaEm: EstadoPartida.ms(principal.createdAt),
      iniciadaEm: EstadoPartida.ms(principal.startedAt),
      expiraEm: EstadoPartida.ms(principal.expiresAt),
      encerradaEm: EstadoPartida.ms(principal.finishedAt),
      pontos: principal.score ?? null,
      achadas,
      resolvidas
    });
  }

  static transicaoValida(de, para) {
    return (EstadoPartida.TRANSICOES[de] || []).includes(para);
  }

  get emEspera() { return this.status === EstadoPartida.STATUS.ESPERA; }
  get emAndamento() { return this.status === EstadoPartida.STATUS.JOGANDO; }
  get encerrada() { return EstadoPartida.TRANSICOES[this.status]?.length === 0; }
  get lotada() { return this.jogadores.length >= EstadoPartida.MAX_JOGADORES; }
  get totalDeEnigmas() { return this.config.ordem.length; }
  get totalResolvidos() { return Object.keys(this.resolvidas).length; }
  get duracaoMs() { return Dificuldade.duracaoMs(this.dificuldade); }

  get dicasUsadas() {
    return Object.values(this.resolvidas).reduce((t, r) => t + (r.hints || 0), 0);
  }

  get tentativasFalhas() {
    return Object.values(this.resolvidas).reduce((t, r) => t + (r.attempts || 0), 0);
  }

  get tempoUsadoMs() {
    if (!this.iniciadaEm) return 0;
    const fim = this.encerradaEm ?? this.iniciadaEm;
    return Math.max(0, fim - this.iniciadaEm);
  }

  get tempoRestanteFinalMs() {
    if (!this.expiraEm || !this.encerradaEm) return 0;
    return Math.max(0, this.expiraEm - this.encerradaEm);
  }

  participa(uid) { return this.jogadores.includes(uid); }
  pistaEncontrada(objetoId) { return Object.hasOwn(this.achadas, objetoId); }
  resolvido(chave) { return Object.hasOwn(this.resolvidas, chave); }

  registrarPista(objetoId, dados) { this.achadas[objetoId] = dados; }
  registrarResolucao(chave, dados) { this.resolvidas[chave] = dados; }

  // Um objeto está concluído quando sua pista foi lida ou seu enigma foi resolvido
  objetoConcluido(objetoId) {
    if (this.pistaEncontrada(objetoId)) return true;
    return Object.entries(this.config.enigmas).some(([chave, e]) => e.objeto === objetoId && this.resolvido(chave));
  }

  // Motivo pelo qual o objeto ainda não responde, ou null quando está liberado
  motivoDeBloqueio(objeto) {
    const requisito = objeto.requisito;
    if (requisito && !this.objetoConcluido(requisito)) return "Algo ainda impede o acesso a isto.";
    if (objeto.estadoInicial === "hidden" && !requisito) return "Nada de interessante aqui.";
    const pista = this.config.pistas[objeto.id];
    if (pista?.requer && !this.resolvido(pista.requer)) return "Está preso por um mecanismo que você ainda não entende.";
    return null;
  }

  objetoLiberado(objeto) {
    return this.motivoDeBloqueio(objeto) === null;
  }
}
