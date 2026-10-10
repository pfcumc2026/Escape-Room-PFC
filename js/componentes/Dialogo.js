// Janela sobreposta ao jogo, com fundo escurecido e fechamento por Esc

export class Dialogo {
  constructor(raiz = document.body) {
    this.raiz = raiz;
    this.fundo = document.createElement("div");
    this.fundo.className = "sala-dialogo";
    this.fundo.hidden = true;
    this.fundo.innerHTML = `<div class="sala-dialogo__caixa" role="dialog" aria-modal="true"></div>`;
    this.caixa = this.fundo.firstElementChild;
    this.aoFechar = null;
    this.anterior = null;

    this.fundo.addEventListener("mousedown", (ev) => { if (ev.target === this.fundo) this.fechar(); });
    this.aoTecla = (ev) => { if (ev.key === "Escape" && this.aberto) this.fechar(); };
    document.addEventListener("keydown", this.aoTecla);
    raiz.appendChild(this.fundo);
  }

  get aberto() {
    return !this.fundo.hidden;
  }

  abrir(conteudo, { largo = false, aoFechar = null, rotulo = "Janela" } = {}) {
    this.anterior = document.activeElement;
    this.aoFechar = aoFechar;
    this.caixa.classList.toggle("sala-dialogo__caixa--larga", largo);
    this.caixa.setAttribute("aria-label", rotulo);
    this.caixa.textContent = "";
    this.caixa.appendChild(conteudo);
    this.fundo.hidden = false;
    const foco = this.caixa.querySelector("[data-foco]") || this.caixa.querySelector("button, textarea, input");
    if (foco) foco.focus();
  }

  fechar() {
    if (!this.aberto) return;
    this.fundo.hidden = true;
    const aoFechar = this.aoFechar;
    this.aoFechar = null;
    if (aoFechar) aoFechar();
    if (this.anterior && document.contains(this.anterior)) this.anterior.focus();
  }

  destruir() {
    document.removeEventListener("keydown", this.aoTecla);
    this.fundo.remove();
  }

  // Bloco simples de título e parágrafos
  static texto({ titulo, eyebrow = "", paragrafos = [], rotuloBotao = "Fechar", aoFechar = () => {} }) {
    const no = document.createElement("div");
    no.className = "sala-texto";
    if (eyebrow) {
      const e = document.createElement("p");
      e.className = "sala-eyebrow";
      e.textContent = eyebrow;
      no.appendChild(e);
    }
    const h = document.createElement("h2");
    h.className = "sala-titulo";
    h.textContent = titulo;
    no.appendChild(h);
    paragrafos.forEach((t, i) => {
      const p = document.createElement("p");
      p.className = i === paragrafos.length - 1 && paragrafos.length > 1 ? "sala-texto__destaque" : "";
      p.textContent = t;
      no.appendChild(p);
    });
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-outline-secondary btn-sm sala-texto__fechar";
    b.textContent = rotuloBotao;
    b.dataset.foco = "";
    b.addEventListener("click", aoFechar);
    no.appendChild(b);
    return no;
  }
}
