// Base de todas as páginas: prepara o acesso e depois monta a tela

import { tema } from "../nucleo/Tema.js";
import { Dom } from "../nucleo/Dom.js";
import { Icones } from "../nucleo/Icones.js";
import { notificador } from "../nucleo/Notificador.js";
import { ControleAcesso } from "../servicos/ControleAcesso.js";

export class Pagina {
  constructor() {
    this.tema = tema;
    this.controle = new ControleAcesso();
  }

  async iniciar() {
    this.tema.iniciar();
    try {
      if (!await this.preparar()) return;
    } catch (e) {
      // Servidor fora do ar ou ainda iniciando (o plano gratuito do Render hiberna sem uso)
      Dom.pronto();
      notificador.falha(e, "Não foi possível conectar ao servidor. Tente novamente em instantes.");
      return;
    }
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
