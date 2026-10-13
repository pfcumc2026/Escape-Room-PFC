// Sala do jogo: pontos de vista e hotspots configurados pelo administrador

import { Hotspot } from "./Hotspot.js";
import { ObjetoInterativo } from "./ObjetoInterativo.js";
import { PontoDeVista } from "./PontoDeVista.js";

export class Sala {
  constructor({ id, nome, descricao = "", renders = [], hotspots = [], publicada = true, mapa = null }) {
    this.id = id;
    this.nome = nome;
    this.descricao = descricao;
    this.publicada = publicada;
    this.mapa = mapa;
    this.renders = renders.map((r) => (r instanceof PontoDeVista ? r : new PontoDeVista(r)));
    this.definirHotspots(hotspots);
  }

  static deDados(dados) {
    return new Sala({ ...dados, hotspots: (dados.hotspots || []).map((h) => new Hotspot(h)) });
  }

  get inicio() {
    return this.renders[0]?.id || "";
  }

  definirHotspots(hotspots) {
    this.hotspots = hotspots;
    this.objetos = ObjetoInterativo.agrupar(hotspots);
  }

  render(id) {
    return this.renders.find((r) => r.id === id) || null;
  }

  objeto(id) {
    return this.objetos.get(id) || null;
  }

  hotspotsDoRender(renderId) {
    return this.hotspots.filter((h) => h.renderId === renderId && h.enabled);
  }

  // Hotspot do objeto na vista de detalhe em que ele aparece maior (destino do "aproximar")
  vistaDeDetalhe(objetoId) {
    return this.hotspots
      .filter((h) => h.objectId === objetoId && h.enabled && this.render(h.renderId)?.destaque)
      .sort((a, b) => b.area - a.area)[0] || null;
  }

  // Pontos de vista que o jogador consegue alcançar: setas a partir do início e, com mapa, qualquer vista marcada nele
  get rendersAlcancaveis() {
    const vistos = new Set();
    const fila = [this.inicio];
    while (fila.length) {
      const id = fila.pop();
      if (vistos.has(id) || !this.render(id)) continue;
      vistos.add(id);
      this.render(id).ligacoes.forEach((l) => fila.push(l.destino));
    }
    if (this.mapa) this.renders.filter((r) => r.mapa).forEach((r) => vistos.add(r.id));
    return vistos;
  }

  // Erro de validação ou null
  validar() {
    const hotspot = this.hotspots.map((h) => h.validar()).find(Boolean);
    if (hotspot) return hotspot;
    for (const r of this.renders) {
      if (r.ligacoes.some((l) => !this.render(l.destino))) return `Uma seta de "${r.titulo}" leva a um ponto de vista que não existe.`;
      if (r.mapa && (r.mapa.x < 0 || r.mapa.x > 1 || r.mapa.y < 0 || r.mapa.y > 1)) return `Posição inválida no mapa para "${r.titulo}".`;
    }
    return null;
  }

  get objetosAtivos() {
    return [...this.objetos.values()].filter((o) => o.ativo);
  }

  paraDados() {
    return {
      id: this.id, nome: this.nome, descricao: this.descricao, publicada: this.publicada,
      mapa: this.mapa,
      renders: this.renders.map((r) => r.paraDados()),
      hotspots: this.hotspots.map((h) => h.paraDados())
    };
  }
}
