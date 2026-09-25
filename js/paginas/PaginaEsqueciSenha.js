// Recuperação de senha pelo fluxo oficial do Firebase

import { Pagina } from "./Pagina.js";
import { Dom } from "../nucleo/Dom.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoAutenticacao } from "../servicos/ServicoAutenticacao.js";

export class PaginaEsqueciSenha extends Pagina {
  constructor() {
    super();
    this.autenticacao = new ServicoAutenticacao();
  }

  async montar() {
    this.form = this.el("form-reset");
    this.btn = this.el("btn-enviar");
    this.form.addEventListener("submit", (ev) => this.#enviar(ev));
  }

  async #enviar(ev) {
    ev.preventDefault();
    const email = this.form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { notificador.erro("Digite um e-mail válido."); return; }

    Dom.ocupado(this.btn, true, "Enviando...");
    try {
      await this.autenticacao.enviarRedefinicaoSenha(email);
    } catch (e) {
      if (e.code !== "auth/user-not-found") {
        notificador.falha(e, "Não foi possível enviar o e-mail.");
        Dom.ocupado(this.btn, false);
        return;
      }
      console.warn("[Placeholder] recuperação solicitada para e-mail inexistente");
    }
    Dom.ocupado(this.btn, false);
    notificador.sucesso("Se existir uma conta com esse e-mail, o link de redefinição foi enviado.", 7000);
    this.form.reset();
  }
}
