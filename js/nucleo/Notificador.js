// Avisos temporários (toasts) exibidos no canto da tela

import { ErroApp } from "./ErroApp.js";
import { TradutorErros } from "./TradutorErros.js";

export class Notificador {
  static ID_AREA = "ph-toasts";

  #area() {
    let area = document.getElementById(Notificador.ID_AREA);
    if (!area) {
      area = document.createElement("div");
      area.id = Notificador.ID_AREA;
      document.body.appendChild(area);
    }
    return area;
  }

  mostrar(mensagem, tipo = "info", ms = 4200) {
    const el = document.createElement("div");
    el.className = `ph-toast ph-toast--${tipo}`;
    el.setAttribute("role", tipo === "err" ? "alert" : "status");
    el.textContent = mensagem;
    this.#area().appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  info(mensagem, ms) { this.mostrar(mensagem, "info", ms); }
  sucesso(mensagem, ms) { this.mostrar(mensagem, "ok", ms); }
  erro(mensagem, ms) { this.mostrar(mensagem, "err", ms); }

  // Erros de regra de negócio já trazem a mensagem; os demais são traduzidos
  falha(excecao, padrao) {
    if (excecao instanceof ErroApp) this.mostrar(excecao.message, excecao.tipo, excecao.duracao);
    else this.mostrar(TradutorErros.traduzir(excecao, padrao), "err");
  }
}

export const notificador = new Notificador();
