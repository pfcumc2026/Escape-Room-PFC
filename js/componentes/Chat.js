// Mensagens do grupo nas últimas 24 horas

import { Lista } from "./Lista.js";

export class Chat extends Lista {
  renderizar(mensagens, uid, agora) {
    this.limpar();
    if (!mensagens.length) {
      this.vazio("Nenhuma mensagem nas últimas 24 horas.");
      return;
    }
    mensagens.forEach((mensagem) => {
      const bloco = document.createElement("div");
      bloco.className = `ph-msg ${mensagem.ehDe(uid) ? "ph-msg--own" : ""} ${mensagem.recente(agora) ? "ph-msg--new" : ""}`;
      const cabecalho = document.createElement("div");
      cabecalho.className = "ph-msg__head";
      cabecalho.textContent = mensagem.cabecalho;
      const corpo = document.createElement("div");
      corpo.className = "ph-msg__body";
      corpo.textContent = mensagem.text;
      bloco.append(cabecalho, corpo);
      this.elemento.appendChild(bloco);
    });
    this.elemento.scrollTop = this.elemento.scrollHeight;
  }
}
