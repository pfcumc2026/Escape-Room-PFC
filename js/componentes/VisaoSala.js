// Ponto de vista da sala no estilo Myst: setas para andar, aproximar ao clicar nos objetos e mapa

import { MapaSala } from "./MapaSala.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const CHEVRON = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const TECLAS = { ArrowUp: "frente", ArrowLeft: "esquerda", ArrowDown: "tras", ArrowRight: "direita" };

export class VisaoSala {
  // navegacao: false desliga setas, mapa, teclado e animações (usado pelo editor)
  constructor(elemento, { aoEscolher = () => {}, aoTrocar = () => {}, navegacao = true } = {}) {
    this.elemento = elemento;
    this.aoEscolher = aoEscolher;
    this.aoTrocar = aoTrocar;
    this.navegacao = navegacao;
    this.sala = null;
    this.renderId = null;
    this.historico = [];
    this.hotspots = [];
    this.mapa = null;
    this.#montarEstrutura();
    if (navegacao) {
      this.aoTecla = (ev) => this.#aoTecla(ev);
      document.addEventListener("keydown", this.aoTecla);
    }
  }

  destruir() {
    if (this.aoTecla) document.removeEventListener("keydown", this.aoTecla);
  }

  #montarEstrutura() {
    this.elemento.classList.add("sala-visao");
    this.elemento.innerHTML = `
      <div class="sala-palco sala-palco--carregando">
        <div class="sala-cena">
          <img class="sala-render" alt="" draggable="false">
          <svg class="sala-camada" viewBox="0 0 1 1" preserveAspectRatio="none" aria-label="Áreas exploráveis"></svg>
          <div class="sala-setas"></div>
        </div>
        <div class="sala-rotulo" hidden></div>
        <div class="sala-barra" hidden>
          <button type="button" class="sala-botao" data-acao="mapa">Mapa</button>
          <button type="button" class="sala-botao" data-acao="voltar">Voltar</button>
        </div>
      </div>
      <div class="sala-legenda"></div>`;
    this.palco = this.elemento.querySelector(".sala-palco");
    this.cena = this.elemento.querySelector(".sala-cena");
    this.imagem = this.elemento.querySelector(".sala-render");
    this.svg = this.elemento.querySelector(".sala-camada");
    this.setas = this.elemento.querySelector(".sala-setas");
    this.rotulo = this.elemento.querySelector(".sala-rotulo");
    this.legenda = this.elemento.querySelector(".sala-legenda");
    this.barra = this.elemento.querySelector(".sala-barra");

    this.imagem.addEventListener("load", () => {
      this.palco.classList.remove("sala-palco--carregando");
      this.#precarregar();
    });
    this.palco.addEventListener("pointerleave", () => { this.rotulo.hidden = true; });

    if (this.navegacao) {
      this.barra.hidden = false;
      this.botaoMapa = this.barra.querySelector('[data-acao="mapa"]');
      this.botaoVoltar = this.barra.querySelector('[data-acao="voltar"]');
      this.botaoMapa.addEventListener("click", () => this.mapa?.alternar());
      this.botaoVoltar.addEventListener("click", () => this.voltar());
      this.mapa = new MapaSala(this.palco, { aoEscolher: (id) => this.mostrar(id) });
    }
  }

  definirSala(sala, renderInicial) {
    this.sala = sala;
    this.historico = [];
    if (this.mapa) {
      this.mapa.definirSala(sala);
      this.botaoMapa.hidden = !sala.mapa;
    }
    return this.mostrar(renderInicial || sala.inicio, { registrar: false });
  }

  // Vai até outro ponto de vista, sem animação
  mostrar(renderId, { registrar = true } = {}) {
    const render = this.sala.render(renderId);
    if (!render || (this.navegacao && renderId === this.renderId)) return;
    this.#trocar(render, registrar);
  }

  #trocar(render, registrar) {
    if (registrar && this.renderId) this.historico.push(this.renderId);
    this.renderId = render.id;
    this.palco.classList.add("sala-palco--carregando");
    this.palco.classList.toggle("sala-palco--destaque", render.destaque);
    this.imagem.src = this.#url(render);
    this.imagem.alt = render.titulo;
    this.legenda.textContent = render.titulo;
    if (this.botaoVoltar) this.botaoVoltar.disabled = !this.historico.length;
    if (this.navegacao) this.#desenharSetas(render);
    if (this.mapa) this.mapa.atualizar(render.id);
    this.aoTrocar(render.id);
  }

  #url(render) {
    return new URL(render.arquivo, document.baseURI).href;
  }

  voltar() {
    const anterior = this.historico.pop();
    if (anterior) this.mostrar(anterior, { registrar: false });
  }

  // Setas

  #desenharSetas(render) {
    this.setas.textContent = "";
    render.ligacoes.forEach((l) => {
      const destino = this.sala.render(l.destino);
      if (!destino) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `sala-seta sala-seta--${l.direcao}`;
      b.style.left = `${l.x * 100}%`;
      b.style.top = `${l.y * 100}%`;
      b.innerHTML = CHEVRON;
      b.title = destino.titulo;
      b.setAttribute("aria-label", destino.titulo);
      b.addEventListener("click", () => this.#seguir(l));
      this.setas.appendChild(b);
    });
  }

  #seguir(ligacao) {
    this.mostrar(ligacao.destino);
  }

  #aoTecla(ev) {
    if (document.querySelector(".sala-dialogo:not([hidden])")) return;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) return;
    if (ev.key === "Backspace") { ev.preventDefault(); this.voltar(); return; }
    const direcao = TECLAS[ev.key];
    const ligacao = direcao && this.sala?.render(this.renderId)?.ligacaoPara(direcao);
    if (ligacao) { ev.preventDefault(); this.#seguir(ligacao); }
  }

  // Carrega antes as imagens para onde as setas levam, para a troca parecer instantânea
  #precarregar() {
    const render = this.sala?.render(this.renderId);
    if (!render || !this.navegacao) return;
    render.ligacoes.forEach((l) => {
      const destino = this.sala.render(l.destino);
      if (destino) new Image().src = this.#url(destino);
    });
  }

  // Coordenadas normalizadas (0 a 1) de um evento do ponteiro sobre a imagem
  ponto(evento) {
    const r = this.svg.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (evento.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (evento.clientY - r.top) / r.height))
    };
  }

  static forma(hotspot) {
    if (hotspot.shape === "rect") {
      const { x1, y1, x2, y2 } = hotspot.caixa;
      const r = document.createElementNS(SVG_NS, "rect");
      r.setAttribute("x", x1);
      r.setAttribute("y", y1);
      r.setAttribute("width", x2 - x1);
      r.setAttribute("height", y2 - y1);
      return r;
    }
    const p = document.createElementNS(SVG_NS, "polygon");
    p.setAttribute("points", hotspot.coordinates.map((c) => c.join(",")).join(" "));
    return p;
  }

  // Áreas maiores ficam atrás das menores para que objetos pequenos continuem clicáveis
  desenhar(hotspots, prontos = new Set()) {
    this.hotspots = [...hotspots].sort((a, b) => b.area - a.area);
    this.svg.textContent = "";
    this.hotspots.forEach((hotspot) => {
      const forma = VisaoSala.forma(hotspot);
      forma.classList.add("sala-hotspot");
      if (this.#aproximaAoClicar(hotspot)) forma.classList.add("sala-hotspot--aproximar");
      if (prontos.has(hotspot.objectId)) forma.classList.add("sala-hotspot--pronto");
      forma.setAttribute("tabindex", "0");
      forma.setAttribute("role", "button");
      forma.setAttribute("aria-label", hotspot.name);
      forma.dataset.id = hotspot.id;
      forma.addEventListener("click", () => this.#aoClicarHotspot(hotspot));
      forma.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); this.#aoClicarHotspot(hotspot); }
      });
      forma.addEventListener("pointermove", (ev) => this.#mostrarRotulo(ev, hotspot));
      forma.addEventListener("pointerleave", () => { this.rotulo.hidden = true; });
      this.svg.appendChild(forma);
    });
  }

  // Numa vista geral, clicar num objeto leva à vista de detalhe dele (se houver)
  #detalheDe(hotspot) {
    const render = this.sala?.render(this.renderId);
    if (!this.navegacao || !render || render.destaque) return null;
    return this.sala.vistaDeDetalhe(hotspot.objectId);
  }

  #aproximaAoClicar(hotspot) {
    return !!this.#detalheDe(hotspot);
  }

  #aoClicarHotspot(hotspot) {
    const detalhe = this.#detalheDe(hotspot);
    if (!detalhe) { this.aoEscolher(hotspot); return; }
    this.rotulo.hidden = true;
    this.mostrar(detalhe.renderId);
  }

  // O nome do objeto só aparece nas vistas de detalhe
  #mostrarRotulo(ev, hotspot) {
    if (!this.palco.classList.contains("sala-palco--destaque")) return;
    const r = this.palco.getBoundingClientRect();
    this.rotulo.textContent = hotspot.name;
    this.rotulo.hidden = false;
    this.rotulo.style.left = `${ev.clientX - r.left + 14}px`;
    this.rotulo.style.top = `${ev.clientY - r.top + 14}px`;
  }
}
