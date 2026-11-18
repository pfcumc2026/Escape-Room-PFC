// Avalia o código do jogador contra os testes comportamentais do enigma

import { ExecutorPython } from "../nucleo/ExecutorPython.js";
import { TentativaEnigma } from "../modelos/TentativaEnigma.js";
import { Enigma } from "../modelos/Enigma.js";

export class GerenciadorEnigmas {
  constructor(executor = new ExecutorPython()) {
    this.executor = executor;
  }

  preparar() {
    this.executor.preparar().catch(() => {});
  }

  async executarRascunho(codigo) {
    const r = await this.executor.executar({ codigo, nomeFuncao: "", modo: "executar" });
    return TentativaEnigma.deExecucao(r);
  }

  // Sem def: executar roda o código com os valores da pista já definidos
  async executar(enigma, codigo) {
    let fonte = codigo;
    let deslocamento = 0;
    if (enigma.semDef) {
      const valores = enigma.parametros.map((p, i) => `${p} = ${Enigma.repr(enigma.entrada[i])}\n`).join("");
      fonte = valores + codigo;
      deslocamento = enigma.parametros.length;
    }
    const r = await this.executor.executar({ codigo: fonte, nomeFuncao: enigma.nomeFuncao, modo: "executar" });
    if (r.linha) r.linha = Math.max(1, r.linha - deslocamento);
    return TentativaEnigma.deExecucao(r);
  }

  // Sem def: o código do jogador vira o corpo da função e devolve "resultado"
  static #embrulhar(enigma, codigo) {
    const corpo = codigo.trim() ? codigo.replace(/^/gm, "    ") : "    pass";
    return `def ${enigma.nomeFuncao}(${enigma.parametros.join(", ")}):\n${corpo}\n    return resultado\n`;
  }

  static #ajustarLinhas(r, totalLinhas) {
    const ajusta = (l) => (l && l - 1 >= 1 && l - 1 <= totalLinhas ? l - 1 : null);
    r.linha = ajusta(r.linha);
    (r.falhas || []).forEach((f) => { f.linha = ajusta(f.linha); });
  }

  async validar(enigma, codigo, codigoDigitado) {
    const embrulhar = enigma.semDef;
    const r = await this.executor.executar({
      codigo: embrulhar ? GerenciadorEnigmas.#embrulhar(enigma, codigo) : codigo,
      nomeFuncao: enigma.nomeFuncao, testes: enigma.testes, entrada: enigma.entrada, modo: "validar"
    });
    if (embrulhar) GerenciadorEnigmas.#ajustarLinhas(r, codigo.split("\n").length);
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
