// Login por e-mail e senha

import { PaginaConvidado } from "./PaginaConvidado.js";
import { Dom } from "../nucleo/Dom.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoAutenticacao } from "../servicos/ServicoAutenticacao.js";

export class PaginaLogin extends PaginaConvidado {
  constructor() {
    super();
    this.autenticacao = new ServicoAutenticacao();
  }

  async preparar() {
    const parametros = new URLSearchParams(location.search);
    this.emailVerificado = parametros.has("verificado");
    if (this.emailVerificado) {
      const proximo = parametros.get("proximo");
      history.replaceState(null, "", proximo ? `login.html?proximo=${encodeURIComponent(proximo)}` : "login.html");
    }
    return super.preparar();
  }

  async montar() {
    this.form = this.el("form-login");
    this.btn = this.el("btn-entrar");
    this.form.addEventListener("submit", (ev) => this.#entrar(ev));
    if (this.emailVerificado) notificador.sucesso("E-mail verificado. Entre para continuar.");
  }

  async #entrar(ev) {
    ev.preventDefault();
    const email = this.form.email.value.trim();
    const senha = this.form.senha.value;
    if (!email || !senha) { notificador.erro("Preencha e-mail e senha."); return; }

    Dom.ocupado(this.btn, true, "Entrando...");
    try {
      const usuario = await this.autenticacao.entrarComSenha(email, senha);
      await this.controle.rotearAposLogin(usuario);
    } catch (e) {
      notificador.falha(e, "Não foi possível entrar.");
      Dom.ocupado(this.btn, false);
    }
  }
}
