// Pedido de redefinição de senha: a resposta é a mesma exista ou não a conta

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
      const { mensagem } = await this.autenticacao.enviarRedefinicaoSenha(email);
      notificador.sucesso(mensagem, 7000);
      this.form.reset();
    } catch (e) {
      notificador.falha(e, "Não foi possível enviar o e-mail.");
    }
    Dom.ocupado(this.btn, false);
  }
}
