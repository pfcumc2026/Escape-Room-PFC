// Login por e-mail/senha e Google, com segundo fator (TOTP) e migração das contas antigas

import { PaginaConvidado } from "./PaginaConvidado.js";
import { Dom } from "../nucleo/Dom.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoAutenticacao } from "../servicos/ServicoAutenticacao.js";
import { QrCode } from "../componentes/QrCode.js";

const { ETAPAS } = ServicoAutenticacao;

export class PaginaLogin extends PaginaConvidado {
  // Avisos do retorno do Google (parâmetro ?erro=)
  static ERROS_GOOGLE = {
    google_cancelado: "O login com o Google foi cancelado.",
    google_indisponivel: "O login com o Google não está configurado no servidor.",
    google_estado: "Não foi possível confirmar o login com o Google. Tente novamente.",
    google_expirado: "O login com o Google expirou. Tente novamente.",
    google_falhou: "O Google não confirmou a identidade. Tente novamente.",
    google_outra_conta: "Esta conta do Escape.py já está vinculada a outra conta Google.",
    conta_em_uso: "Já existe uma conta com este e-mail. Tente entrar novamente.",
    migracao_indisponivel: "A migração de contas antigas está indisponível no momento. Tente mais tarde."
  };

  constructor() {
    super();
    this.autenticacao = new ServicoAutenticacao();
    this.desafio = null;
    this.etapa = null;
    this.usuario = null;
  }

  async preparar() {
    const parametros = new URLSearchParams(location.search);
    this.codigoGoogle = parametros.get("google");
    this.erroGoogle = parametros.get("erro");
    this.emailVerificado = parametros.has("verificado");
    if (this.codigoGoogle || this.erroGoogle || this.emailVerificado) {
      const proximo = parametros.get("proximo");
      history.replaceState(null, "", proximo ? `login.html?proximo=${encodeURIComponent(proximo)}` : "login.html");
    }
    return super.preparar();
  }

  async montar() {
    this.form = this.el("form-login");
    this.btn = this.el("btn-entrar");
    this.bloco2fa = this.el("bloco-2fa");

    this.form.addEventListener("submit", (ev) => this.#entrar(ev));
    this.el("btn-2fa").addEventListener("click", (ev) => this.#confirmarSegundoFator(ev.currentTarget));
    this.el("codigo-2fa").addEventListener("keydown", (ev) => { if (ev.key === "Enter") this.el("btn-2fa").click(); });
    this.el("btn-novo-autenticador").addEventListener("click", (ev) => this.#ativarNovoAutenticador(ev.currentTarget));
    this.el("btn-continuar").addEventListener("click", () => this.controle.rotearAposLogin(this.usuario));
    this.el("btn-google").addEventListener("click", () => this.autenticacao.entrarComGoogle("login"));

    if (this.emailVerificado) notificador.sucesso("E-mail verificado. Entre para continuar.");
    if (this.erroGoogle) notificador.erro(PaginaLogin.ERROS_GOOGLE[this.erroGoogle] || "Não foi possível entrar com o Google.", 7000);
    if (this.codigoGoogle) await this.#concluirGoogle();
  }

  async #entrar(ev) {
    ev.preventDefault();
    const email = this.form.email.value.trim();
    const senha = this.form.senha.value;
    if (!email || !senha) { notificador.erro("Preencha e-mail e senha."); return; }

    Dom.ocupado(this.btn, true, "Entrando...");
    try {
      await this.#seguir(await this.autenticacao.entrarComSenha(email, senha));
    } catch (e) {
      notificador.falha(e, "Não foi possível entrar.");
    }
    Dom.ocupado(this.btn, false);
  }

  async #concluirGoogle() {
    try {
      await this.#seguir(await this.autenticacao.concluirGoogle(this.codigoGoogle));
    } catch (e) {
      notificador.falha(e, "Não foi possível entrar com o Google.");
    }
  }

  // Avança conforme a etapa pedida pelo servidor
  async #seguir(resultado) {
    this.etapa = resultado.etapa;
    this.desafio = resultado.desafio || null;

    if (resultado.etapa === ETAPAS.CONCLUIDO) {
      this.usuario = resultado.usuario;
      if (resultado.codigosRecuperacao) { this.#mostrarCodigos(resultado.codigosRecuperacao); return; }
      await this.controle.rotearAposLogin(resultado.usuario);
      return;
    }
    if (resultado.etapa === ETAPAS.CONFIGURAR_2FA) { await this.#pedirNovoAutenticador(); return; }

    const legado = resultado.etapa === ETAPAS.SEGUNDO_FATOR_LEGADO;
    this.el("dica-2fa").textContent = legado
      ? "Use o código do aplicativo autenticador que você já cadastrou no sistema antigo."
      : "Sem acesso ao aplicativo? Digite um dos seus códigos de recuperação.";
    this.el("codigo-2fa").value = "";
    this.bloco2fa.classList.remove("d-none");
    this.el("codigo-2fa").focus();
    notificador.info("Informe o código do seu aplicativo autenticador.");
  }

  async #confirmarSegundoFator(botao) {
    if (!this.desafio) return;
    const digitado = this.el("codigo-2fa").value.trim();
    const codigo = /^[\d\s]+$/.test(digitado) ? digitado.replace(/\D/g, "") : digitado;
    const legado = this.etapa === ETAPAS.SEGUNDO_FATOR_LEGADO;
    if (legado || /^\d+$/.test(codigo)) {
      if (codigo.length !== 6) { notificador.erro("Digite os 6 dígitos do código."); return; }
    } else if (codigo.length < 10) {
      notificador.erro("Código de recuperação inválido.");
      return;
    }

    Dom.ocupado(botao, true, "Confirmando...");
    try {
      const resultado = legado
        ? await this.autenticacao.concluirSegundoFatorLegado(this.desafio, codigo)
        : await this.autenticacao.concluirSegundoFator(this.desafio, codigo);
      this.bloco2fa.classList.add("d-none");
      await this.#seguir(resultado);
    } catch (e) {
      notificador.falha(e, "Código inválido ou expirado.");
      if (e.code === "DESAFIO_EXPIRADO" || e.status === 429) this.bloco2fa.classList.add("d-none");
    }
    Dom.ocupado(botao, false);
  }

  async #pedirNovoAutenticador() {
    try {
      const segredo = await this.autenticacao.prepararNovoAutenticador(this.desafio);
      new QrCode(this.el("qr-novo-autenticador"), "QR Code indisponível: use a chave abaixo.").desenhar(segredo.uri);
      Dom.texto("#chave-novo-autenticador", segredo.secret);
      this.el("bloco-novo-autenticador").classList.remove("d-none");
      this.el("codigo-novo-autenticador").focus();
    } catch (e) {
      notificador.falha(e, "Não foi possível preparar o novo autenticador. Entre novamente.");
    }
  }

  async #ativarNovoAutenticador(botao) {
    const codigo = this.el("codigo-novo-autenticador").value.replace(/\D/g, "");
    if (codigo.length !== 6) { notificador.erro("Digite os 6 dígitos gerados pelo aplicativo."); return; }
    Dom.ocupado(botao, true, "Confirmando...");
    try {
      const resultado = await this.autenticacao.ativarNovoAutenticador(this.desafio, codigo);
      this.el("bloco-novo-autenticador").classList.add("d-none");
      notificador.sucesso("Novo autenticador cadastrado. Sua conta foi migrada.");
      await this.#seguir(resultado);
    } catch (e) {
      notificador.falha(e, "Código inválido. Confira o aplicativo e tente novamente.");
    }
    Dom.ocupado(botao, false);
  }

  #mostrarCodigos(codigos) {
    const lista = this.el("lista-codigos");
    lista.textContent = "";
    codigos.forEach((codigo) => {
      const item = document.createElement("li");
      item.textContent = codigo;
      lista.appendChild(item);
    });
    this.form.classList.add("d-none");
    this.el("bloco-codigos").classList.remove("d-none");
  }
}
