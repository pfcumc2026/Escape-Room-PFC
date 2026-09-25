// Tela de verificação de e-mail

import { Pagina } from "./Pagina.js";
import { Dom } from "../nucleo/Dom.js";
import { Icones } from "../nucleo/Icones.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoAutenticacao } from "../servicos/ServicoAutenticacao.js";

export class PaginaVerificarEmail extends Pagina {
  constructor() {
    super();
    this.autenticacao = new ServicoAutenticacao();
    this.usuario = null;
  }

  async preparar() {
    this.usuario = await this.autenticacao.usuarioAtual();
    if (!this.usuario) { location.replace("login.html"); return false; }
    if (this.usuario.emailVerified) { await this.controle.rotearAposLogin(this.usuario); return false; }
    Dom.pronto();
    Icones.renderizar();
    return true;
  }

  async montar() {
    Dom.texto("#email-usuario", this.usuario.email || "");
    this.btnVerificar = this.el("btn-verificar");
    this.btnReenviar = this.el("btn-reenviar");

    this.btnVerificar.addEventListener("click", () => this.#verificar());
    this.btnReenviar.addEventListener("click", () => this.#reenviar());
    this.el("btn-sair").addEventListener("click", () => this.controle.sair());
  }

  async #verificar() {
    Dom.ocupado(this.btnVerificar, true, "Verificando...");
    try {
      await this.usuario.reload();
      if (this.usuario.emailVerified) {
        await this.usuario.getIdToken(true);
        notificador.sucesso("E-mail verificado.");
        await this.controle.rotearAposLogin(this.usuario);
      } else {
        notificador.erro("O e-mail ainda não consta como verificado. Confira sua caixa de entrada e o spam.", 6000);
      }
    } catch (e) {
      notificador.falha(e, "Não foi possível checar o status.");
    }
    Dom.ocupado(this.btnVerificar, false);
  }

  async #reenviar() {
    Dom.ocupado(this.btnReenviar, true, "Enviando...");
    try {
      await this.autenticacao.enviarVerificacao(this.usuario);
      notificador.sucesso("Novo e-mail de verificação enviado.");
    } catch (e) {
      notificador.falha(e, "Não foi possível reenviar o e-mail.");
    }
    Dom.ocupado(this.btnReenviar, false);
  }
}
