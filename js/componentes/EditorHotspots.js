// Edição visual sobre o render: hotspots (desenhar, mover, redimensionar) e setas de navegação

import { VisaoSala } from "./VisaoSala.js";
import { Hotspot } from "../modelos/Hotspot.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const TAMANHO_MINIMO = 0.01;
const RAIO_FECHAMENTO = 0.018;

export class EditorHotspots {
  static FERRAMENTAS = ["selecionar", "retangulo", "poligono", "seta"];

  constructor(visao, { sala, aoSelecionar, aoSelecionarSeta = () => {}, aoAlterar }) {
    this.visao = visao;
    this.sala = sala;
    this.aoSelecionar = aoSelecionar;
    this.aoSelecionarSeta = aoSelecionarSeta;
    this.aoAlterar = aoAlterar;
    this.seta = null;
    this.ferramenta = "selecionar";
    this.selecionado = null;
    this.gesto = null;
    this.pontosNovos = [];
    this.cursor = null;

    const svg = visao.svg;
    svg.addEventListener("pointerdown", (ev) => this.#aoPressionar(ev));
    svg.addEventListener("pointermove", (ev) => this.#aoMover(ev));
    svg.addEventListener("pointerup", (ev) => this.#aoSoltar(ev));
    svg.addEventListener("dblclick", (ev) => this.#aoDuploClique(ev));
    this.aoTecla = (ev) => this.#aoTecla(ev);
    document.addEventListener("keydown", this.aoTecla);
  }

  destruir() {
    document.removeEventListener("keydown", this.aoTecla);
  }

  get renderId() {
    return this.visao.renderId;
  }

  definirFerramenta(ferramenta) {
    this.ferramenta = ferramenta;
    this.pontosNovos = [];
    this.cursor = null;
    this.visao.svg.style.cursor = ferramenta === "selecionar" ? "default" : "crosshair";
    this.desenhar();
  }

  get pontoDeVista() {
    return this.sala.render(this.renderId);
  }

  selecionar(hotspot) {
    this.selecionado = hotspot;
    this.seta = null;
    this.desenhar();
    this.aoSelecionar(hotspot);
    this.aoSelecionarSeta(null);
  }

  selecionarSeta(ligacao) {
    this.selecionado = null;
    this.seta = ligacao;
    this.desenhar();
    this.aoSelecionar(null);
    this.aoSelecionarSeta(ligacao);
  }

  excluirSelecionado() {
    if (this.seta) {
      const id = this.seta.id;
      this.pontoDeVista.removerLigacao(id);
      this.selecionarSeta(null);
      this.aoAlterar({ seta: id });
      return;
    }
    if (!this.selecionado) return;
    const id = this.selecionado.id;
    this.sala.definirHotspots(this.sala.hotspots.filter((h) => h.id !== id));
    this.selecionado = null;
    this.desenhar();
    this.aoSelecionar(null);
    this.aoAlterar({ removido: id });
  }

  // Desenho

  desenhar() {
    const svg = this.visao.svg;
    svg.textContent = "";
    const daTela = this.sala.hotspots.filter((h) => h.renderId === this.renderId);
    const ordenados = [...daTela].sort((a, b) => b.area - a.area);

    ordenados.forEach((h) => {
      const forma = VisaoSala.forma(h);
      forma.classList.add("ed-forma");
      if (!h.enabled) forma.classList.add("ed-forma--inativa");
      if (h === this.selecionado) forma.classList.add("ed-forma--atual");
      forma.dataset.id = h.id;
      const titulo = document.createElementNS(SVG_NS, "title");
      titulo.textContent = h.name;
      forma.appendChild(titulo);
      svg.appendChild(forma);
    });

    this.#desenharSetas();
    if (this.selecionado && this.selecionado.renderId === this.renderId) this.#desenharAlcas(this.selecionado);
    this.#desenharRascunho();
  }

  // Elipse com raio em pixels: o SVG normalizado (0 a 1) distorce círculos comuns
  #ponto(x, y, raioPx, classe) {
    const caixa = this.visao.svg.getBoundingClientRect();
    const e = document.createElementNS(SVG_NS, "ellipse");
    e.setAttribute("cx", x);
    e.setAttribute("cy", y);
    e.setAttribute("rx", raioPx / caixa.width);
    e.setAttribute("ry", raioPx / caixa.height);
    e.setAttribute("class", classe);
    this.visao.svg.appendChild(e);
    return e;
  }

  #desenharSetas() {
    (this.pontoDeVista?.ligacoes || []).forEach((l) => {
      const e = this.#ponto(l.x, l.y, 13, `ed-seta${l === this.seta ? " ed-seta--atual" : ""}`);
      e.dataset.seta = l.id;
      const titulo = document.createElementNS(SVG_NS, "title");
      titulo.textContent = `${l.direcao} → ${this.sala.render(l.destino)?.titulo || l.destino}`;
      e.appendChild(titulo);
    });
  }

  #desenharAlcas(h) {
    h.pontos.forEach((p, i) => {
      this.#ponto(p[0], p[1], 7, "ed-ponto").dataset.alca = String(i);
    });
  }

  #desenharRascunho() {
    if (this.gesto?.tipo === "novoRect") {
      const { inicio, atual } = this.gesto;
      const r = document.createElementNS(SVG_NS, "rect");
      r.setAttribute("x", Math.min(inicio.x, atual.x));
      r.setAttribute("y", Math.min(inicio.y, atual.y));
      r.setAttribute("width", Math.abs(atual.x - inicio.x));
      r.setAttribute("height", Math.abs(atual.y - inicio.y));
      r.setAttribute("class", "ed-rascunho");
      this.visao.svg.appendChild(r);
    }
    if (this.pontosNovos.length) {
      const pts = [...this.pontosNovos, ...(this.cursor ? [this.cursor] : [])];
      const linha = document.createElementNS(SVG_NS, "polyline");
      linha.setAttribute("points", pts.map((p) => `${p[0]},${p[1]}`).join(" "));
      linha.setAttribute("class", "ed-rascunho");
      linha.setAttribute("fill", "none");
      this.visao.svg.appendChild(linha);
      this.pontosNovos.forEach((p, i) => {
        this.#ponto(p[0], p[1], i === 0 ? 8 : 5, "ed-ponto").style.pointerEvents = "none";
      });
    }
  }

  // Interação

  #hotspotDoAlvo(alvo) {
    const id = alvo.dataset?.id;
    return id ? this.sala.hotspots.find((h) => h.id === id) : null;
  }

  #aoPressionar(ev) {
    if (ev.button !== 0) return;
    const p = this.visao.ponto(ev);

    if (this.ferramenta === "retangulo") {
      this.visao.svg.setPointerCapture(ev.pointerId);
      this.gesto = { tipo: "novoRect", inicio: p, atual: p };
      return;
    }
    if (this.ferramenta === "poligono") {
      this.#adicionarPonto(p);
      return;
    }
    if (this.ferramenta === "seta") {
      this.#criarSeta(p);
      return;
    }
    if (ev.target.dataset?.seta !== undefined) {
      const ligacao = this.pontoDeVista.ligacoes.find((l) => l.id === ev.target.dataset.seta);
      this.visao.svg.setPointerCapture(ev.pointerId);
      this.gesto = { tipo: "seta", ligacao, moveu: false };
      this.selecionarSeta(ligacao);
      return;
    }

    if (ev.target.dataset?.alca !== undefined && this.selecionado) {
      this.visao.svg.setPointerCapture(ev.pointerId);
      this.gesto = { tipo: "alca", indice: Number(ev.target.dataset.alca), ultimo: p };
      return;
    }
    const h = this.#hotspotDoAlvo(ev.target);
    if (h) {
      this.visao.svg.setPointerCapture(ev.pointerId);
      this.gesto = { tipo: "mover", ultimo: p, moveu: false };
      if (h !== this.selecionado) this.selecionar(h);
    } else if (this.selecionado || this.seta) {
      this.selecionar(null);
    }
  }

  #aoMover(ev) {
    const p = this.visao.ponto(ev);
    if (this.ferramenta === "poligono" && this.pontosNovos.length) {
      this.cursor = [p.x, p.y];
      this.desenhar();
      return;
    }
    const g = this.gesto;
    if (!g) return;

    if (g.tipo === "novoRect") {
      g.atual = p;
    } else if (g.tipo === "mover" && this.selecionado) {
      this.selecionado.mover(p.x - g.ultimo.x, p.y - g.ultimo.y);
      g.ultimo = p;
      g.moveu = true;
    } else if (g.tipo === "alca" && this.selecionado) {
      this.#moverAlca(this.selecionado, g.indice, p);
    } else if (g.tipo === "seta") {
      g.ligacao.x = p.x;
      g.ligacao.y = p.y;
      g.moveu = true;
    }
    this.desenhar();
  }

  #moverAlca(h, indice, p) {
    if (h.shape === "poly") {
      h.coordinates[indice] = [p.x, p.y];
      return;
    }
    const [x1, y1, x2, y2] = h.coordinates;
    // Cantos na ordem: superior esquerdo, superior direito, inferior direito, inferior esquerdo
    const fixoX = indice === 0 || indice === 3 ? x2 : x1;
    const fixoY = indice === 0 || indice === 1 ? y2 : y1;
    h.coordinates = [Math.min(p.x, fixoX), Math.min(p.y, fixoY), Math.max(p.x, fixoX), Math.max(p.y, fixoY)];
    // Reordena o canto arrastado para continuar correspondendo à alça
    const movidoX = p.x < fixoX;
    const movidoY = p.y < fixoY;
    const mapa = { "true,true": 0, "false,true": 1, "false,false": 2, "true,false": 3 };
    this.gesto.indice = mapa[`${movidoX},${movidoY}`];
  }

  #aoSoltar() {
    const g = this.gesto;
    this.gesto = null;
    if (!g) return;

    if (g.tipo === "novoRect") {
      const { inicio, atual } = g;
      if (Math.abs(atual.x - inicio.x) >= TAMANHO_MINIMO && Math.abs(atual.y - inicio.y) >= TAMANHO_MINIMO) {
        this.#criar("rect", [
          Math.min(inicio.x, atual.x), Math.min(inicio.y, atual.y),
          Math.max(inicio.x, atual.x), Math.max(inicio.y, atual.y)
        ]);
        return;
      }
    } else if (g.tipo === "seta") {
      if (g.moveu) this.aoAlterar({ seta: g.ligacao.id });
    } else if (g.moveu || g.tipo === "alca") {
      this.aoAlterar({ alterado: this.selecionado });
    }
    this.desenhar();
  }

  #adicionarPonto(p) {
    const primeiro = this.pontosNovos[0];
    if (primeiro && this.pontosNovos.length >= 3 && Math.hypot(p.x - primeiro[0], p.y - primeiro[1]) < RAIO_FECHAMENTO) {
      this.#concluirPoligono();
      return;
    }
    if (this.pontosNovos.length >= Hotspot.MAX_PONTOS) { this.#concluirPoligono(); return; }
    this.pontosNovos.push([p.x, p.y]);
    this.desenhar();
  }

  #aoDuploClique(ev) {
    if (this.ferramenta === "poligono") {
      // Os dois cliques do duplo clique já adicionaram o mesmo ponto
      if (this.pontosNovos.length > 1) this.pontosNovos.pop();
      this.#concluirPoligono();
      return;
    }
    const alca = ev.target.dataset?.alca;
    if (alca !== undefined && this.selecionado?.shape === "poly" && this.selecionado.coordinates.length > 3) {
      this.selecionado.coordinates.splice(Number(alca), 1);
      this.aoAlterar({ alterado: this.selecionado });
      this.desenhar();
    }
  }

  #criarSeta(p) {
    const ponto = this.pontoDeVista;
    const outro = this.sala.renders.find((r) => r.id !== ponto.id);
    const ligacao = ponto.adicionarLigacao(outro.id, "frente", p.x, p.y);
    this.ferramenta = "selecionar";
    this.visao.svg.style.cursor = "default";
    this.aoAlterar({ seta: ligacao.id, criada: true });
    this.selecionarSeta(ligacao);
  }

  #concluirPoligono() {
    if (this.pontosNovos.length >= 3) this.#criar("poly", this.pontosNovos);
    this.pontosNovos = [];
    this.cursor = null;
    this.desenhar();
  }

  #criar(forma, coordenadas) {
    const id = Hotspot.novoId();
    const h = new Hotspot({
      id, objectId: id, roomId: this.sala.id, renderId: this.renderId, name: "Novo objeto",
      shape: forma, coordinates: coordenadas, interactionType: "INSPECT", description: ""
    });
    this.sala.definirHotspots([...this.sala.hotspots, h]);
    this.pontosNovos = [];
    this.cursor = null;
    this.ferramenta = "selecionar";
    this.visao.svg.style.cursor = "default";
    this.aoAlterar({ criado: h });
    this.selecionar(h);
  }

  #aoTecla(ev) {
    const emCampo = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
    if (emCampo) return;
    if (ev.key === "Escape") { this.pontosNovos = []; this.cursor = null; this.gesto = null; this.desenhar(); }
    if (ev.key === "Enter" && this.ferramenta === "poligono") this.#concluirPoligono();
    if ((ev.key === "Delete" || ev.key === "Backspace") && (this.selecionado || this.seta)) { ev.preventDefault(); this.excluirSelecionado(); }
  }
}
