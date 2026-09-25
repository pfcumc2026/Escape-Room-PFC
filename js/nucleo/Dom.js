// Atalhos de manipulação do DOM

import { Icones } from "./Icones.js";

export class Dom {
  static porId(id) {
    return document.getElementById(id);
  }

  static elemento(seletor) {
    return typeof seletor === "string" ? document.querySelector(seletor) : seletor;
  }

  static texto(seletor, valor) {
    const el = Dom.elemento(seletor);
    if (el) el.textContent = valor ?? "";
  }

  static ocupado(botao, ativo, textoOcupado = "Aguarde...") {
    if (!botao) return;
    if (ativo) {
      botao.dataset.phConteudo = botao.innerHTML;
      botao.disabled = true;
      botao.textContent = textoOcupado;
    } else {
      botao.disabled = false;
      if (botao.dataset.phConteudo !== undefined) {
        botao.innerHTML = botao.dataset.phConteudo;
        Icones.renderizar();
      }
    }
  }

  static pronto() {
    document.body.classList.remove("ph-loading");
  }
}
