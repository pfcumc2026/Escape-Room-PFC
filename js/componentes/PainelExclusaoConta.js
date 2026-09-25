// Exclusão definitiva da conta, com dupla confirmação

import { Dom } from "../nucleo/Dom.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoConta } from "../servicos/ServicoConta.js";

export class PainelExclusaoConta {
  constructor(conta, perfil) {
    this.conta = conta;
    this.perfil = perfil;
    this.modal = new bootstrap.Modal(Dom.porId("modal-excluir"));
  }

  iniciar() {
    Dom.texto("#username-esperado", this.perfil.username);
    Dom.porId("btn-excluir").addEventListener("click", () => this.modal.show());
    Dom.porId("btn-confirmar-exclusao").addEventListener("click", (ev) => this.#excluir(ev.currentTarget));
  }

  async #excluir(botao) {
    const digitado = Dom.porId("confirma-username").value.trim();
    if (digitado.toLowerCase() !== this.perfil.usernameLower) {
      notificador.erro("O username digitado não corresponde à sua conta.");
      return;
    }
    if (!confirm("Esta ação é permanente e apagará seus dados. Deseja excluir sua conta agora?")) return;

    Dom.ocupado(botao, true, "Excluindo...");
    try {
      await this.conta.excluir(this.perfil);
      location.replace("login.html");
    } catch (e) {
      if (e.message !== ServicoConta.CANCELADO) notificador.falha(e, "Não foi possível excluir a conta.");
      Dom.ocupado(botao, false);
    }
  }
}
