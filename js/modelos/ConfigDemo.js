export class ConfigDemo {
  static DIFICULDADE = "facil";
  static SEMENTE = 111;

  static CONFIG = {
    versao: 1,
    ordem: ["p1", "p2", "pf"],
    enigmas: {
      p1: { modeloId: "chave-numerica", variante: 6, objeto: "painel", pistas: ["livro"], final: false },
      p2: { modeloId: "balanca-da-porta", variante: 6, objeto: "cadeado", pistas: ["brasao_flor"], final: false },
      pf: { modeloId: "pulsos-da-esfera", variante: 6, objeto: "esfera", pistas: ["pergaminhos"], final: true }
    },
    pistas: {
      livro: { enigma: "p1", indice: 0, requer: "" },
      brasao_flor: { enigma: "p2", indice: 0, requer: "p1" },
      pergaminhos: { enigma: "pf", indice: 0, requer: "" }
    }
  };
}
