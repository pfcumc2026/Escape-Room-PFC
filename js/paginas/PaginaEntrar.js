// Entrada em um grupo por link/QR Code

import { Pagina } from "./Pagina.js";
import { Dom } from "../nucleo/Dom.js";
import { Icones } from "../nucleo/Icones.js";
import { notificador } from "../nucleo/Notificador.js";
import { Grupo } from "../modelos/Grupo.js";
import { ServicoAutenticacao } from "../servicos/ServicoAutenticacao.js";
import { ServicoPerfil } from "../servicos/ServicoPerfil.js";
import { ServicoGrupos } from "../servicos/ServicoGrupos.js";

export class PaginaEntrar extends Pagina {
  constructor() {
    super();
    this.autenticacao = new ServicoAutenticacao();
    this.perfis = new ServicoPerfil();
    this.grupos = new ServicoGrupos();
    this.usuario = null;
  }

  async preparar() {
    const parametros = new URLSearchParams(location.search);
    this.idGrupo = parametros.get("g") || "";
    this.codigo = parametros.get("c") || "";

    this.usuario = await this.autenticacao.usuarioAtual();
    if (!this.usuario) {
      const destino = `entrar.html?g=${encodeURIComponent(this.idGrupo)}&c=${encodeURIComponent(this.codigo)}`;
      location.replace(`login.html?proximo=${encodeURIComponent(destino)}`);
      return false;
    }
    if (!this.usuario.emailVerified) { location.replace("verificar-email.html"); return false; }

    Dom.pronto();
    Icones.renderizar();
    return true;
  }

  async montar() {
    this.btn = this.el("btn-entrar");
    this.btn.addEventListener("click", () => this.#entrar());

    if (!Grupo.idValido(this.idGrupo) || !Grupo.codigoValido(this.codigo)) {
      Dom.texto("#estado", "Este link de convite é inválido.");
      return;
    }

    const perfil = await this.perfis.carregar(this.usuario.uid);
    if (!perfil || !perfil.completo) {
      Dom.texto("#estado", "Finalize seu perfil para poder entrar no grupo. Depois, abra o link do convite novamente.");
      setTimeout(() => location.replace("perfil.html"), 2500);
      return;
    }

    const jaMembro = await this.grupos.carregar(this.idGrupo)
      .then((grupo) => !!grupo && grupo.contem(this.usuario.uid))
      .catch(() => false);
    if (jaMembro) {
      location.replace(`grupo.html?id=${encodeURIComponent(this.idGrupo)}`);
      return;
    }

    Dom.texto("#estado", "Convite válido. Confirme para entrar no grupo.");
    this.btn.classList.remove("d-none");
  }

  async #entrar() {
    Dom.ocupado(this.btn, true, "Entrando...");
    try {
      await this.grupos.entrarComCodigo(this.idGrupo, this.usuario.uid, this.codigo);
      location.replace(`grupo.html?id=${encodeURIComponent(this.idGrupo)}`);
    } catch (e) {
      if (e.code === "permission-denied") {
        Dom.texto("#estado", "Não foi possível entrar: o grupo pode estar cheio ou o código do convite mudou.");
        notificador.erro("Convite inválido ou grupo cheio.");
      } else {
        notificador.falha(e, "Não foi possível entrar no grupo.");
      }
      Dom.ocupado(this.btn, false);
    }
  }
}
