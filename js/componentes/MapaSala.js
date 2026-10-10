// Mapa no canto da cena, como o de um street view: mostra onde você está e leva ao ponto clicado

export class MapaSala {
  constructor(palco, { aoEscolher }) {
    this.aoEscolher = aoEscolher;
    this.sala = null;
    this.atualId = null;
    this.elemento = document.createElement("aside");
    this.elemento.className = "sala-mapa";
    this.elemento.hidden = true;
    this.elemento.setAttribute("aria-label", "Mapa do estúdio");
    this.elemento.innerHTML = `
      <div class="sala-mapa__topo">
        <span>Mapa</span>
        <button type="button" class="sala-mapa__fechar" aria-label="Fechar mapa">&times;</button>
      </div>
      <div class="sala-mapa__quadro"><img alt="Vista de cima do estúdio" draggable="false"></div>
      <p class="sala-mapa__legenda"></p>`;
    this.quadro = this.elemento.querySelector(".sala-mapa__quadro");
    this.legenda = this.elemento.querySelector(".sala-mapa__legenda");
    this.elemento.querySelector(".sala-mapa__fechar").addEventListener("click", () => this.fechar());
    palco.appendChild(this.elemento);
  }

  get aberto() {
    return !this.elemento.hidden;
  }

  definirSala(sala) {
    this.sala = sala;
    this.quadro.querySelectorAll(".sala-mapa__ponto").forEach((p) => p.remove());
    if (!sala.mapa) return;
    this.quadro.querySelector("img").src = new URL(sala.mapa.arquivo, document.baseURI).href;

    sala.renders.filter((r) => r.mapa).forEach((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sala-mapa__ponto";
      b.dataset.render = r.id;
      b.style.left = `${r.mapa.x * 100}%`;
      b.style.top = `${r.mapa.y * 100}%`;
      b.setAttribute("aria-label", r.titulo);
      b.innerHTML = `<span class="sala-mapa__cone" style="transform: rotate(${r.mapa.angulo}deg)"></span>`;
      b.addEventListener("click", () => this.aoEscolher(r.id));
      b.addEventListener("pointerenter", () => { this.legenda.textContent = r.titulo; });
      b.addEventListener("pointerleave", () => this.#legendaAtual());
      this.quadro.appendChild(b);
    });
    this.#legendaAtual();
  }

  atualizar(renderId) {
    this.atualId = renderId;
    this.quadro.querySelectorAll(".sala-mapa__ponto").forEach((p) => {
      p.classList.toggle("sala-mapa__ponto--atual", p.dataset.render === renderId);
    });
    this.#legendaAtual();
  }

  #legendaAtual() {
    this.legenda.textContent = this.sala?.render(this.atualId)?.titulo || "";
  }

  alternar() {
    this.elemento.hidden = !this.elemento.hidden;
  }

  fechar() {
    this.elemento.hidden = true;
  }
}
