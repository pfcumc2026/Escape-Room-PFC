// QR Code desenhado com as cores do tema atual

import { tema } from "../nucleo/Tema.js";

export class QrCode {
  constructor(elemento, mensagemIndisponivel = "") {
    this.elemento = elemento;
    this.mensagemIndisponivel = mensagemIndisponivel;
  }

  desenhar(texto, tamanho = 190) {
    this.elemento.textContent = "";
    if (!window.QRCode) {
      if (this.mensagemIndisponivel) this.elemento.textContent = this.mensagemIndisponivel;
      return;
    }
    new QRCode(this.elemento, {
      text: texto,
      width: tamanho,
      height: tamanho,
      colorDark: tema.corTraco,
      colorLight: tema.corFundo
    });
  }
}
