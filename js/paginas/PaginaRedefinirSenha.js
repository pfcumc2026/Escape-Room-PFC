// Nova senha a partir do link de redefinição (?token=), válido uma única vez

import { Pagina } from "./Pagina.js";
import { Dom } from "../nucleo/Dom.js";
import { Limites } from "../nucleo/Limites.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoAutenticacao } from "../servicos/ServicoAutenticacao.js";

export class PaginaRedefinirSenha extends Pagina {
  constructor() {
    super();
    this.autenticacao = new ServicoAutenticacao();
  }

  async montar() {
    this.token = new URLSearchParams(location.search).get("token") || "";
    history.replaceState(null, "", "redefinir-senha.html");
    this.form = this.el("form-redefinir");
    this.btn = this.el("btn-redefinir");
    if (!this.token) {
      notificador.erro("Link de redefinição inválido. Peça um novo.");
      this.btn.disabled = true;
      return;
    }
    this.form.addEventListener("submit", (ev) => this.#redefinir(ev));
  }

  #validar(senha, senha2) {
    if (senha.length < Limites.senhaMin) return `A senha precisa ter pelo menos ${Limites.senhaMin} caracteres.`;
    if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) return "A senha precisa conter letras e números.";
    if (senha !== senha2) return "As senhas não coincidem.";
    return null;
  }

  async #redefinir(ev) {
    ev.preventDefault();
    const senha = this.form.senha.value;
    const problema = this.#validar(senha, this.form.senha2.value);
    if (problema) { notificador.erro(problema); return; }

    Dom.ocupado(this.btn, true, "Salvando...");
    try {
      await this.autenticacao.redefinirSenha(this.token, senha);
      await this.autenticacao.sair();
      notificador.sucesso("Senha redefinida. Entre com a nova senha.");
      setTimeout(() => location.replace("login.html"), 1500);
    } catch (e) {
      notificador.falha(e, "Não foi possível redefinir a senha.");
      Dom.ocupado(this.btn, false);
    }
  }
}
