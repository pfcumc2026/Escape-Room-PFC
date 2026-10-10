// Avalia o código do jogador contra os testes comportamentais do enigma

import { ExecutorPython } from "../nucleo/ExecutorPython.js";
import { TentativaEnigma } from "../modelos/TentativaEnigma.js";

export class GerenciadorEnigmas {
  constructor(executor = new ExecutorPython()) {
    this.executor = executor;
  }

  preparar() {
    this.executor.preparar().catch(() => {});
  }

  async executar(enigma, codigo) {
    const r = await this.executor.executar({ codigo, nomeFuncao: enigma.nomeFuncao, modo: "executar" });
    return TentativaEnigma.deExecucao(r);
  }

  async validar(enigma, codigo, codigoDigitado) {
    const r = await this.executor.executar({
      codigo, nomeFuncao: enigma.nomeFuncao, testes: enigma.testes, entrada: enigma.entrada, modo: "validar"
    });
    const tentativa = TentativaEnigma.deExecucao(r);
    // O código esperado é conferido contra o valor calculado pela função do jogador
    if (tentativa.fase === "ok" && r.codigo !== enigma.codigoEsperado) {
      return new TentativaEnigma({
        fase: "codigo", penaliza: true, saida: tentativa.saida,
        titulo: "Os testes passaram, mas a função não se comporta bem com os valores da pista.",
        detalhes: ["Revise os casos que o enigma não testa de forma explícita."]
      });
    }
    return TentativaEnigma.conferirCodigo(tentativa, codigoDigitado, enigma.codigoEsperado);
  }
}
