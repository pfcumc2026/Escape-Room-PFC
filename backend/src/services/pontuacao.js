const BASE_POR_ENIGMA = 200;
const PENALIDADE_DICA = 40;
const PENALIDADE_TENTATIVA = 10;
export const PONTUACAO_MAXIMA = 5000;

const BONUS_POR_SEGUNDO = { facil: 0.15, medio: 0.1, dificil: 0.08 };

export function somarUso(resolvidos = {}) {
  const lista = Object.values(resolvidos);
  return {
    dicas: lista.reduce((t, e) => t + (e.hints || 0), 0),
    tentativas: lista.reduce((t, e) => t + (e.attempts || 0), 0)
  };
}

export function calcularPontuacao({ dificuldade, resolvidos, dicas, tentativas, restanteMs }) {
  const bonus = Math.floor((Math.max(0, restanteMs) / 1000) * BONUS_POR_SEGUNDO[dificuldade]);
  const total = resolvidos * BASE_POR_ENIGMA + bonus - dicas * PENALIDADE_DICA - tentativas * PENALIDADE_TENTATIVA;
  return Math.min(PONTUACAO_MAXIMA, Math.max(0, total));
}
