// Base de todas as páginas: prepara o acesso e depois monta a tela

import { tema } from "../nucleo/Tema.js";
import { Dom } from "../nucleo/Dom.js";
import { Icones } from "../nucleo/Icones.js";
import { ControleAcesso } from "../servicos/ControleAcesso.js";

export class Pagina {
  constructor() {
    this.tema = tema;
    this.controle = new ControleAcesso();
  }

  async iniciar() {
    this.tema.iniciar();
    if (!await this.preparar()) return;
    await this.montar();
    Icones.renderizar();
  }

  // Retorna false quando a página já está redirecionando
  async preparar() {
    Dom.pronto();
    Icones.renderizar();
    return true;
  }

  async montar() {}

  el(id) {
    return Dom.porId(id);
  }
}
