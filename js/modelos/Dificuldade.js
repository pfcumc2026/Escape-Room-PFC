// Níveis de dificuldade da partida (espelhados nas Security Rules)

export class Dificuldade {
  static NIVEIS = {
    facil: { id: "facil", nome: "Fácil", minutos: 25, enigmas: 3, bonusPorSegundo: 0.15, foco: "Variáveis, aritmética, strings e condições simples." },
    medio: { id: "medio", nome: "Médio", minutos: 45, enigmas: 4, bonusPorSegundo: 0.1, foco: "Laços, listas, strings e funções, com pistas indiretas." },
    dificil: { id: "dificil", nome: "Difícil", minutos: 60, enigmas: 5, bonusPorSegundo: 0.08, foco: "Lógica aninhada, algoritmos e uma cadeia de dependências." }
  };

  static ids() {
    return Object.keys(Dificuldade.NIVEIS);
  }

  static valida(id) {
    return Object.hasOwn(Dificuldade.NIVEIS, id);
  }

  static de(id) {
    if (!Dificuldade.valida(id)) throw new Error(`Dificuldade desconhecida: ${id}`);
    return Dificuldade.NIVEIS[id];
  }

  static duracaoMs(id) {
    return Dificuldade.de(id).minutos * 60 * 1000;
  }
}
