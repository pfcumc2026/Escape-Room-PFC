// Ponto de vista da sala: um render, suas setas de navegação e sua posição no mapa

export class PontoDeVista {
  static DIRECOES = {
    frente: "Em frente",
    esquerda: "Para a esquerda",
    direita: "Para a direita",
    tras: "Para trás"
  };

  // Posição padrão de cada seta na imagem (fração da largura e da altura)
  static POSICAO_PADRAO = {
    frente: [0.5, 0.5],
    esquerda: [0.05, 0.5],
    direita: [0.95, 0.5],
    tras: [0.5, 0.92]
  };

  constructor({ id, arquivo, titulo = "", destaque = false, mapa = null, ligacoes = [] }) {
    this.id = id;
    this.arquivo = arquivo;
    this.titulo = titulo;
    this.destaque = !!destaque;
    this.mapa = mapa ? { x: mapa.x, y: mapa.y, angulo: mapa.angulo || 0 } : null;
    this.ligacoes = ligacoes.map((l) => ({ ...l }));
  }

  static novoId(prefixo = "s") {
    return `${prefixo}_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  }

  ligacaoPara(direcao) {
    return this.ligacoes.find((l) => l.direcao === direcao) || null;
  }

  adicionarLigacao(destino, direcao, x, y) {
    const [px, py] = PontoDeVista.POSICAO_PADRAO[direcao];
    const ligacao = { id: PontoDeVista.novoId(), destino, direcao, x: x ?? px, y: y ?? py };
    this.ligacoes.push(ligacao);
    return ligacao;
  }

  removerLigacao(id) {
    this.ligacoes = this.ligacoes.filter((l) => l.id !== id);
  }

  paraDados() {
    const r = (v) => Math.round(v * 10000) / 10000;
    return {
      id: this.id,
      arquivo: this.arquivo,
      titulo: this.titulo,
      destaque: this.destaque,
      mapa: this.mapa ? { x: r(this.mapa.x), y: r(this.mapa.y), angulo: Math.round(this.mapa.angulo) } : null,
      ligacoes: this.ligacoes.map((l) => ({ id: l.id, destino: l.destino, direcao: l.direcao, x: r(l.x), y: r(l.y) }))
    };
  }
}
