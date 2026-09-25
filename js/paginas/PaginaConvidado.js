// Páginas de login e cadastro: quem já está autenticado é redirecionado

import { Pagina } from "./Pagina.js";
import { Dom } from "../nucleo/Dom.js";
import { Icones } from "../nucleo/Icones.js";

export class PaginaConvidado extends Pagina {
  async preparar() {
    if (await this.controle.redirecionarSeLogado()) return false;
    Dom.pronto();
    Icones.renderizar();
    return true;
  }
}
