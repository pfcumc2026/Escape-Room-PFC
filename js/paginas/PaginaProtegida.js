// Páginas que exigem conta autenticada, e-mail verificado e perfil

import { Pagina } from "./Pagina.js";
import { Dom } from "../nucleo/Dom.js";
import { Icones } from "../nucleo/Icones.js";

export class PaginaProtegida extends Pagina {
  constructor({ exigirPerfil = true, exigirAdmin = false } = {}) {
    super();
    this.exigirPerfil = exigirPerfil;
    this.exigirAdmin = exigirAdmin;
    this.sessao = null;
  }

  async preparar() {
    this.sessao = await this.controle.exigirAutenticacao({ exigirPerfil: this.exigirPerfil, exigirAdmin: this.exigirAdmin });
    if (!this.sessao) return false;
    Dom.pronto();
    Icones.renderizar();
    return true;
  }
}
