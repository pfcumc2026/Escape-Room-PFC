// Base das listas renderizadas em tela

export class Lista {
  constructor(elemento) {
    this.elemento = elemento;
  }

  limpar() {
    this.elemento.textContent = "";
  }

  vazio(mensagem) {
    const aviso = document.createElement("div");
    aviso.className = "ph-empty";
    aviso.textContent = mensagem;
    this.elemento.appendChild(aviso);
  }

  adicionar(item) {
    this.elemento.appendChild(item.elemento || item);
  }
}
