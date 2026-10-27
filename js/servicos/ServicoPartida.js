// Estado compartilhado da partida na API (/api/games/{gid}); o servidor define o relógio da partida

import { Api } from "../nucleo/Api.js";
import { tempoReal } from "../nucleo/TempoReal.js";
import { EstadoPartida } from "../modelos/EstadoPartida.js";

export class ServicoPartida {
  #caminho(gid, sufixo = "") {
    return `/games/${encodeURIComponent(gid)}${sufixo}`;
  }

  // Diferença entre o relógio do servidor e o do computador do jogador
  async deslocamentoMs() {
    try {
      const inicio = Date.now();
      const { now } = await Api.get("/time");
      return now - (inicio + Date.now()) / 2;
    } catch {
      return 0;
    }
  }

  // Emite null quando não há partida e um EstadoPartida quando há
  observar(gid, aoMudar, aoFalhar) {
    return tempoReal.observar(
      `partida:${gid}`,
      async () => {
        const { game } = await Api.get(this.#caminho(gid));
        return game ? EstadoPartida.deDados(gid, game, game.found, game.solved) : null;
      },
      aoMudar,
      aoFalhar
    );
  }

  criar(gid, { dificuldade, semente, config }) {
    return Api.post(this.#caminho(gid), { difficulty: dificuldade, seed: semente, config });
  }

  entrar(gid) {
    return Api.post(this.#caminho(gid, "/players"));
  }

  iniciar(gid) {
    return Api.post(this.#caminho(gid, "/start"));
  }

  registrarPista(gid, objetoId) {
    return Api.post(this.#caminho(gid, `/clues/${encodeURIComponent(objetoId)}`));
  }

  // Outro jogador pode ter resolvido o mesmo enigma um instante antes: o resultado é o mesmo
  async registrarResolucao(gid, chave, { dicas, tentativas }) {
    try {
      await Api.post(this.#caminho(gid, `/puzzles/${encodeURIComponent(chave)}`), { hints: dicas, attempts: tentativas });
    } catch (e) {
      if (e.code !== "ENIGMA_JA_RESOLVIDO") throw e;
    }
  }

  // O último enigma e a conclusão da partida são gravados juntos pelo servidor
  concluir(gid, chave, { dicas, tentativas }, pontos) {
    return Api.post(this.#caminho(gid, `/puzzles/${encodeURIComponent(chave)}`), { hints: dicas, attempts: tentativas, score: pontos });
  }

  encerrar(gid, status) {
    return Api.post(this.#caminho(gid, "/end"), { status });
  }

  reiniciar(gid) {
    return Api.excluir(this.#caminho(gid));
  }
}
