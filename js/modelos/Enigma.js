// Enigma concreto de uma partida: modelo + variante sorteada pela semente

import { ModelosEnigma } from "./ModelosEnigma.js";
import { Aleatorio } from "../nucleo/Aleatorio.js";

export class Enigma {
  constructor({ chave, modelo, variante, dificuldade, final = false, objeto = "" }) {
    this.chave = chave;
    this.modelo = modelo;
    this.variante = variante;
    this.dificuldade = dificuldade;
    this.final = final;
    this.objeto = objeto;

    const rng = new Aleatorio(variante);
    this.parametrosSorteados = modelo.sortear(rng);
    const casos = modelo.casos(this.parametrosSorteados, rng);
    this.entrada = modelo.entrada(this.parametrosSorteados, rng);
    this.testes = casos.map((args, i) => ({
      args,
      esperado: modelo.f(this.parametrosSorteados, ...args),
      visivel: i < 3
    }));
    this.codigoEsperado = String(modelo.f(this.parametrosSorteados, ...this.entrada));
  }

  static criar(dados) {
    const modelo = ModelosEnigma.porId(dados.modeloId);
    if (!modelo) throw new Error(`Modelo de enigma desconhecido: ${dados.modeloId}`);
    return new Enigma({ ...dados, modelo });
  }

  get titulo() { return this.modelo.titulo; }
  get conceito() { return this.modelo.conceito; }
  get nomeFuncao() { return this.modelo.nomeFuncao; }
  get parametros() { return this.modelo.parametros; }
  get historia() { return this.modelo.historia(this.parametrosSorteados); }
  get dicas() { return this.modelo.dicas(this.parametrosSorteados); }

  get codigoInicial() {
    if (this.modelo.codigoInicial) return this.modelo.codigoInicial(this.parametrosSorteados);
    return `def ${this.nomeFuncao}(${this.parametros.join(", ")}):\n    # escreva seu código aqui\n    return\n`;
  }

  // Um argumento por peça de pista (no máximo duas): o primeiro e o restante
  pecas(quantidade) {
    const rng = Aleatorio.derivar(this.variante, "pecas");
    const grupos = quantidade >= 2 && this.parametros.length >= 2
      ? [[0], this.parametros.map((_, i) => i).slice(1)]
      : [this.parametros.map((_, i) => i)];
    return grupos.map((indices) => indices
      .map((i) => `${this.parametros[i]} = ${Enigma.expressao(this.entrada[i], this.dificuldade, rng)}`)
      .join(", "));
  }

  get quantidadeMaximaDePecas() {
    return this.parametros.length >= 2 ? 2 : 1;
  }

  // Inteiros ganham uma expressão equivalente nas dificuldades mais altas
  static expressao(valor, dificuldade, rng) {
    if (!Number.isInteger(valor) || valor < 2 || dificuldade === "facil") return Enigma.repr(valor);
    if (dificuldade === "medio") {
      const a = rng.inteiro(1, valor - 1);
      return `${a} + ${valor - a}`;
    }
    const b = rng.inteiro(2, 4);
    const a = Math.floor(valor / b);
    const resto = valor - a * b;
    return resto === 0 ? `${a} * ${b}` : `${a} * ${b} + ${resto}`;
  }

  // Representação no estilo do Python
  static repr(valor) {
    if (Array.isArray(valor)) return `[${valor.map(Enigma.repr).join(", ")}]`;
    if (typeof valor === "string") return `'${valor}'`;
    return String(valor);
  }
}
