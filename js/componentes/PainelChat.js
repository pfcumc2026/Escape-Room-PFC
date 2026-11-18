// Chat do grupo dentro da sala: reaproveita ServicoChat e a lista de mensagens do grupo

import { Chat } from "./Chat.js";
import { ServicoChat } from "../servicos/ServicoChat.js";
import { Dom } from "../nucleo/Dom.js";
import { Texto } from "../nucleo/Texto.js";
import { Limites } from "../nucleo/Limites.js";
import { Icones } from "../nucleo/Icones.js";
import { notificador } from "../nucleo/Notificador.js";

export class PainelChat {
  constructor(elemento, { idGrupo, sessao, servico = new ServicoChat() }) {
    this.elemento = elemento;
    this.idGrupo = idGrupo;
    this.sessao = sessao;
    this.servico = servico;
    this.cancelar = null;
  }

  iniciar() {
    this.elemento.innerHTML = `
      <p class="sala-eyebrow">Chat do grupo</p>
      <div class="ph-chat sala-chat__mensagens" role="log" aria-live="polite" aria-label="Mensagens do grupo"></div>
      <form class="d-flex gap-2 mt-2" novalidate>
        <label class="visually-hidden" for="sala-campo-msg">Mensagem</label>
        <input class="form-control form-control-sm" id="sala-campo-msg" maxlength="300" autocomplete="off" placeholder="Converse com a equipe">
        <button class="btn btn-primary btn-sm d-inline-flex align-items-center gap-2" type="submit">
          <i data-lucide="send" aria-hidden="true"></i><span class="visually-hidden">Enviar</span>
        </button>
      </form>`;
    Icones.renderizar();

    this.visao = new Chat(this.elemento.querySelector(".ph-chat"));
    this.campo = this.elemento.querySelector("input");
    this.botao = this.elemento.querySelector("button");
    this.elemento.querySelector("form").addEventListener("submit", (ev) => this.#enviar(ev));

    this.cancelar = this.servico.observar(
      this.idGrupo,
      (mensagens, agora) => this.visao.renderizar(mensagens, this.sessao.uid, agora),
      (e) => notificador.falha(e, "Não foi possível carregar o chat.")
    );
  }

  destruir() {
    if (this.cancelar) this.cancelar();
  }

  async #enviar(ev) {
    ev.preventDefault();
    const texto = Texto.limpar(this.campo.value, Limites.mensagemMax);
    if (!texto) return;
    Dom.ocupado(this.botao, true, "…");
    try {
      await this.servico.enviar(this.idGrupo, this.sessao.autor, texto);
      this.campo.value = "";
    } catch (e) {
      notificador.falha(e, "Não foi possível enviar a mensagem.");
    }
    Dom.ocupado(this.botao, false);
  }
}
