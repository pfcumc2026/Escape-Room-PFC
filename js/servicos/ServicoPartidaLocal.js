// Partida em memória, sem Firebase: usada na pré-visualização do editor de salas

import { EstadoPartida } from "../modelos/EstadoPartida.js";
import { Dificuldade } from "../modelos/Dificuldade.js";

export class ServicoPartidaLocal {
  constructor() {
    this.estado = null;
    this.ouvintes = new Set();
  }

  async deslocamentoMs() {
    return 0;
  }

  observar(gid, aoMudar) {
    this.ouvintes.add(aoMudar);
    aoMudar(this.#copia());
    return () => this.ouvintes.delete(aoMudar);
  }

  #copia() {
    if (!this.estado) return null;
    return new EstadoPartida({ ...this.estado, achadas: { ...this.estado.achadas }, resolvidas: { ...this.estado.resolvidas } });
  }

  #emitir() {
    this.ouvintes.forEach((ouvinte) => ouvinte(this.#copia()));
  }

  async criar(gid, { uid, dificuldade, semente, config }) {
    this.estado = new EstadoPartida({
      id: gid, groupId: gid, ownerId: uid, dificuldade, semente, config, jogadores: [uid], criadaEm: Date.now()
    });
    this.#emitir();
  }

  async entrar(gid, uid) {
    if (!this.estado.participa(uid)) this.estado.jogadores.push(uid);
    this.#emitir();
  }

  async iniciar(gid, dificuldade) {
    this.estado.status = EstadoPartida.STATUS.JOGANDO;
    this.estado.iniciadaEm = Date.now();
    this.estado.expiraEm = Date.now() + Dificuldade.duracaoMs(dificuldade);
    this.#emitir();
  }

  async registrarPista(gid, objetoId, uid) {
    this.estado.registrarPista(objetoId, { by: uid, at: Date.now() });
    this.#emitir();
  }

  async registrarResolucao(gid, chave, { uid, dicas, tentativas }) {
    this.estado.registrarResolucao(chave, { by: uid, at: Date.now(), hints: dicas, attempts: tentativas });
    this.#emitir();
  }

  async concluir(gid, chave, dados, pontos) {
    this.estado.registrarResolucao(chave, { by: dados.uid, at: Date.now(), hints: dados.dicas, attempts: dados.tentativas });
    this.estado.status = EstadoPartida.STATUS.CONCLUIDA;
    this.estado.encerradaEm = Date.now();
    this.estado.pontos = pontos;
    this.#emitir();
  }

  async encerrar(gid, status) {
    this.estado.status = status;
    this.estado.encerradaEm = Date.now();
    this.#emitir();
  }

  async reiniciar() {
    this.estado = null;
    this.#emitir();
  }
}
