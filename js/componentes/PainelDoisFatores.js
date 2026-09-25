// Ativação e desativação do segundo fator (TOTP)

import { Dom } from "../nucleo/Dom.js";
import { notificador } from "../nucleo/Notificador.js";
import { QrCode } from "./QrCode.js";
import { ServicoConta } from "../servicos/ServicoConta.js";

export class PainelDoisFatores {
  constructor(conta, rotulo) {
    this.conta = conta;
    this.rotulo = rotulo;
    this.segredo = null;

    this.fluxo = Dom.porId("fluxo-2fa");
    this.btnAtivar = Dom.porId("btn-ativar-2fa");
    this.btnDesativar = Dom.porId("btn-desativar-2fa");
    this.campoCodigo = Dom.porId("codigo-2fa");
    this.qr = new QrCode(Dom.porId("qr-2fa"));
  }

  iniciar() {
    this.#atualizarEstado();
    this.btnAtivar.addEventListener("click", () => this.#ativar());
    this.btnDesativar.addEventListener("click", () => this.#desativar());
    Dom.porId("btn-confirmar-2fa").addEventListener("click", (ev) => this.#confirmar(ev.currentTarget));
    Dom.porId("btn-cancelar-2fa").addEventListener("click", () => this.#cancelar());
  }

  #atualizarEstado() {
    const ativo = this.conta.segundoFatorAtivo;
    Dom.porId("dot-2fa").classList.toggle("ph-dot--on", ativo);
    Dom.texto("#titulo-2fa", ativo ? "2FA ativo" : "2FA desativado");
    Dom.texto("#detalhe-2fa", ativo
      ? "O login pedirá um código do aplicativo autenticador."
      : "Sua conta é protegida apenas pela senha.");
    this.btnAtivar.classList.toggle("d-none", ativo);
    this.btnDesativar.classList.toggle("d-none", !ativo);
  }

  async #ativar() {
    Dom.ocupado(this.btnAtivar, true, "Preparando...");
    try {
      this.segredo = await this.conta.gerarSegredo();
      this.qr.desenhar(this.conta.uriDoSegredo(this.segredo, this.rotulo));
      Dom.texto("#chave-2fa", this.segredo.secretKey);
      this.fluxo.classList.remove("d-none");
    } catch (e) {
      if (e.message !== ServicoConta.CANCELADO) notificador.falha(e, "Não foi possível iniciar a ativação do 2FA.");
    }
    Dom.ocupado(this.btnAtivar, false);
  }

  async #confirmar(botao) {
    if (!this.segredo) return;
    const codigo = this.campoCodigo.value.replace(/\D/g, "");
    if (codigo.length !== 6) { notificador.erro("Digite os 6 dígitos gerados pelo aplicativo."); return; }

    Dom.ocupado(botao, true, "Confirmando...");
    try {
      await this.conta.ativarSegundoFator(this.segredo, codigo);
      this.segredo = null;
      this.fluxo.classList.add("d-none");
      this.campoCodigo.value = "";
      this.#atualizarEstado();
      notificador.sucesso("2FA ativado.");
    } catch (e) {
      notificador.falha(e, "Código inválido. Tente novamente.");
    }
    Dom.ocupado(botao, false);
  }

  #cancelar() {
    this.segredo = null;
    this.fluxo.classList.add("d-none");
  }

  async #desativar() {
    if (!confirm("Desativar a verificação em duas etapas?")) return;
    Dom.ocupado(this.btnDesativar, true, "Desativando...");
    try {
      await this.conta.desativarSegundoFator();
      this.#atualizarEstado();
      notificador.sucesso("2FA desativado.");
    } catch (e) {
      if (e.message !== ServicoConta.CANCELADO) notificador.falha(e, "Não foi possível desativar o 2FA.");
    }
    Dom.ocupado(this.btnDesativar, false);
  }
}
