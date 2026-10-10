// Gerador pseudoaleatório determinístico: a mesma semente produz a mesma sequência em qualquer navegador

export class Aleatorio {
  constructor(semente) {
    this.estado = Aleatorio.misturar(semente);
  }

  static novaSemente() {
    return crypto.getRandomValues(new Uint32Array(1))[0] % 1000000000;
  }

  // Hash FNV-1a de um número ou texto
  static misturar(valor) {
    const texto = String(valor);
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) {
      h ^= texto.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  static derivar(semente, rotulo) {
    return new Aleatorio(`${semente}:${rotulo}`);
  }

  // mulberry32
  proximo() {
    this.estado = (this.estado + 0x6d2b79f5) >>> 0;
    let t = this.estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  inteiro(min, max) {
    return min + Math.floor(this.proximo() * (max - min + 1));
  }

  chance(probabilidade) {
    return this.proximo() < probabilidade;
  }

  escolher(lista) {
    return lista[this.inteiro(0, lista.length - 1)];
  }

  embaralhar(lista) {
    const copia = [...lista];
    for (let i = copia.length - 1; i > 0; i--) {
      const j = this.inteiro(0, i);
      [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
  }
}
