// Linha padrão das listas (avatar, textos e botões de ação)

export class ItemLista {
  constructor() {
    this.elemento = document.createElement("div");
    this.elemento.className = "ph-item";
    this.principal = document.createElement("div");
    this.principal.className = "ph-item__main";
    this.elemento.appendChild(this.principal);
  }

  avatar(tamanho = "sm") {
    const img = document.createElement("img");
    img.className = `ph-avatar ph-avatar--${tamanho}`;
    img.alt = "";
    this.elemento.insertBefore(img, this.principal);
    return img;
  }

  nome(texto) {
    return this.#linha("ph-item__name", texto);
  }

  meta(texto, classeExtra = "") {
    return this.#linha(`ph-item__meta ${classeExtra}`.trim(), texto);
  }

  acao(elemento) {
    this.elemento.appendChild(elemento);
    return elemento;
  }

  #linha(classe, texto) {
    const div = document.createElement("div");
    div.className = classe;
    div.textContent = texto;
    this.principal.appendChild(div);
    return div;
  }
}
