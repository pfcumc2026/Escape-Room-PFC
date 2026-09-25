// Cadastro de conta

import { PaginaConvidado } from "./PaginaConvidado.js";
import { Dom } from "../nucleo/Dom.js";
import { Texto } from "../nucleo/Texto.js";
import { Limites } from "../nucleo/Limites.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoAutenticacao } from "../servicos/ServicoAutenticacao.js";
import { ServicoAuditoria } from "../servicos/ServicoAuditoria.js";

export class PaginaCadastro extends PaginaConvidado {
  static VERSAO_TERMOS = "1.0";

  constructor() {
    super();
    this.autenticacao = new ServicoAutenticacao();
    this.auditoria = new ServicoAuditoria();
  }

  async montar() {
    this.form = this.el("form-cadastro");
    this.btn = this.el("btn-cadastrar");
    this.form.addEventListener("submit", (ev) => this.#cadastrar(ev));
    this.el("btn-google").addEventListener("click", () => this.#entrarComGoogle());
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
      await this.autenticacao.criarConta(nome, email, senha);
      await this.#registrarAceite();
      location.replace("verificar-email.html");
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

  #registrarAceite() {
    return this.auditoria.registrar("termos_aceitos", `Termo de Aceite e Política de Privacidade v${PaginaCadastro.VERSAO_TERMOS}`);
  }

  async #entrarComGoogle() {
    if (!this.#aceitou()) return;
    try {
      const cred = await this.autenticacao.entrarComGoogle();
      await this.#registrarAceite();
      await this.controle.rotearAposLogin(cred.user);
    } catch (e) {
      notificador.falha(e, "Não foi possível entrar com o Google.");
    }
  }
}
