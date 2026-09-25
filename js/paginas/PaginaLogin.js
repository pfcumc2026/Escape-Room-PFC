// Login por e-mail/senha, Google e segundo fator (TOTP)

import { PaginaConvidado } from "./PaginaConvidado.js";
import { Dom } from "../nucleo/Dom.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoAutenticacao } from "../servicos/ServicoAutenticacao.js";

export class PaginaLogin extends PaginaConvidado {
  constructor() {
    super();
    this.autenticacao = new ServicoAutenticacao();
    this.resolvedor = null;
  }

  async montar() {
    this.form = this.el("form-login");
    this.btn = this.el("btn-entrar");
    this.bloco2fa = this.el("bloco-2fa");

    this.form.addEventListener("submit", (ev) => this.#entrar(ev));
    this.el("btn-2fa").addEventListener("click", () => this.#confirmarSegundoFator());
    this.el("btn-google").addEventListener("click", () => this.#entrarComGoogle());
  }

  async #entrar(ev) {
    ev.preventDefault();
    const email = this.form.email.value.trim();
    const senha = this.form.senha.value;
    if (!email || !senha) { notificador.erro("Preencha e-mail e senha."); return; }

    Dom.ocupado(this.btn, true, "Entrando...");
    try {
      const cred = await this.autenticacao.entrarComSenha(email, senha);
      await this.controle.rotearAposLogin(cred.user);
    } catch (e) {
      if (this.autenticacao.exigeSegundoFator(e)) {
        this.#pedirCodigo(e);
        notificador.info("Informe o código do seu aplicativo autenticador.");
      } else {
        notificador.falha(e, "Não foi possível entrar.");
      }
      Dom.ocupado(this.btn, false);
    }
  }

  async #confirmarSegundoFator() {
    if (!this.resolvedor) return;
    const codigo = this.el("codigo-2fa").value.replace(/\D/g, "");
    if (codigo.length !== 6) { notificador.erro("Digite os 6 dígitos do código."); return; }
    try {
      const cred = await this.autenticacao.concluirSegundoFator(this.resolvedor, codigo);
      await this.controle.rotearAposLogin(cred.user);
    } catch (e) {
      notificador.falha(e, "Código inválido ou expirado.");
    }
  }

  async #entrarComGoogle() {
    try {
      const cred = await this.autenticacao.entrarComGoogle();
      await this.controle.rotearAposLogin(cred.user);
    } catch (e) {
      if (this.autenticacao.exigeSegundoFator(e)) { this.#pedirCodigo(e); return; }
      notificador.falha(e, "Não foi possível entrar com o Google.");
    }
  }

  #pedirCodigo(excecao) {
    this.resolvedor = this.autenticacao.resolvedor(excecao);
    this.bloco2fa.classList.remove("d-none");
    this.el("codigo-2fa").focus();
  }
}
