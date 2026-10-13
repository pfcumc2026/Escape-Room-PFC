// Tela de verificação de e-mail; o link enviado por e-mail traz o token em ?token=

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
    this.erroToken = null;
  }

  async preparar() {
    const parametros = new URLSearchParams(location.search);
    const token = parametros.get("token");
    this.falhaNoEnvio = parametros.has("falha");
    if (token || this.falhaNoEnvio) history.replaceState(null, "", "verificar-email.html");
    if (token) {
      try {
        await this.autenticacao.confirmarEmail(token);
      } catch (e) {
        this.erroToken = e;
      }
    }

    // O link pode ser aberto em outro aparelho, sem sessão: basta entrar depois
    this.usuario = await this.autenticacao.usuarioAtual({ recarregar: true });
    if (!this.usuario) { location.replace(token && !this.erroToken ? "login.html?verificado=1" : "login.html"); return false; }
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

    if (this.erroToken) notificador.falha(this.erroToken, "Link de verificação inválido ou expirado.");
    if (this.falhaNoEnvio) notificador.erro("A conta foi criada, mas o e-mail de verificação não pôde ser enviado. Use o botão para reenviar.", 8000);
  }

  async #verificar() {
    Dom.ocupado(this.btnVerificar, true, "Verificando...");
    try {
      this.usuario = await this.autenticacao.usuarioAtual({ recarregar: true });
      if (!this.usuario) { location.replace("login.html"); return; }
      if (this.usuario.emailVerified) {
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
      await this.autenticacao.enviarVerificacao();
      notificador.sucesso("Novo e-mail de verificação enviado.");
    } catch (e) {
      notificador.falha(e, "Não foi possível reenviar o e-mail.");
    }
    Dom.ocupado(this.btnReenviar, false);
  }
}
