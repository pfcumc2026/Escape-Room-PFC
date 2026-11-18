// Cálculo determinístico da pontuação final

import { Dificuldade } from "./Dificuldade.js";

export class Pontuacao {
  static BASE_POR_ENIGMA = 200;
  static PENALIDADE_DICA = 40;
  static PENALIDADE_TENTATIVA = 10;
  static MAXIMO = 5000;

  static calcular({ dificuldade, resolvidos, dicas, tentativas, restanteMs, concluida }) {
    const base = resolvidos * Pontuacao.BASE_POR_ENIGMA;
    const bonus = concluida ? Math.floor((restanteMs / 1000) * Dificuldade.de(dificuldade).bonusPorSegundo) : 0;
    const penalidades = dicas * Pontuacao.PENALIDADE_DICA + tentativas * Pontuacao.PENALIDADE_TENTATIVA;
    return Math.min(Pontuacao.MAXIMO, Math.max(0, base + bonus - penalidades));
  }
}
