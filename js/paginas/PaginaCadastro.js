// Cadastro de conta

import { PaginaConvidado } from "./PaginaConvidado.js";
import { Dom } from "../nucleo/Dom.js";
import { Texto } from "../nucleo/Texto.js";
import { Limites } from "../nucleo/Limites.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoAutenticacao } from "../servicos/ServicoAutenticacao.js";

export class PaginaCadastro extends PaginaConvidado {
  constructor() {
    super();
    this.autenticacao = new ServicoAutenticacao();
  }

  async montar() {
    this.form = this.el("form-cadastro");
    this.btn = this.el("btn-cadastrar");
    this.form.addEventListener("submit", (ev) => this.#cadastrar(ev));
  }

  #validar(nome, email, senha, senha2) {
    if (nome.length < 2) return "Informe seu nome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "Digite um e-mail válido.";
    if (senha.length < Limites.senhaMin) return `A senha precisa ter pelo menos ${Limites.senhaMin} caracteres.`;
    if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) return "A senha precisa conter letras e números.";
    if (senha !== senha2) return "As senhas não coincidem.";
    return null;
  }

  async #cadastrar(ev) {
    ev.preventDefault();
    const nome = Texto.limpar(this.form.nome.value, 60);
    const email = this.form.email.value.trim();
    const senha = this.form.senha.value;
    const problema = this.#validar(nome, email, senha, this.form.senha2.value);
    if (problema) { notificador.erro(problema); return; }
    if (!this.#aceitou()) return;

    Dom.ocupado(this.btn, true, "Criando conta...");
    try {
      const { emailEnviado } = await this.autenticacao.criarConta(nome, email, senha);
      location.replace(emailEnviado ? "verificar-email.html" : "verificar-email.html?falha=1");
    } catch (e) {
      notificador.falha(e, "Não foi possível criar a conta.");
      Dom.ocupado(this.btn, false);
    }
  }

  #aceitou() {
    if (this.el("aceite").checked) return true;
    notificador.erro("Para criar a conta, aceite o Termo de Aceite e a Política de Privacidade.");
    return false;
  }
}
