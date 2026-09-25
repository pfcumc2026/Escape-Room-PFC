// Consulta dos logs de auditoria (somente administradores)

import { PaginaProtegida } from "./PaginaProtegida.js";
import { Dom } from "../nucleo/Dom.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoAuditoria } from "../servicos/ServicoAuditoria.js";
import { ListaAuditoria } from "../componentes/ListaAuditoria.js";

export class PaginaAuditoria extends PaginaProtegida {
  constructor() {
    super({ exigirAdmin: true });
    this.auditoria = new ServicoAuditoria();
    this.registros = [];
  }

  async montar() {
    this.lista = new ListaAuditoria(this.el("lista-auditoria"));
    this.filtro = this.el("filtro-auditoria");
    this.btnAtualizar = this.el("btn-atualizar");

    this.filtro.addEventListener("input", () => this.#filtrar());
    this.btnAtualizar.addEventListener("click", () => this.#carregar());
    await this.#carregar();
  }

  async #carregar() {
    Dom.ocupado(this.btnAtualizar, true, "Carregando...");
    try {
      this.registros = await this.auditoria.listar();
      this.#filtrar();
    } catch (e) {
      notificador.falha(e, "Não foi possível carregar os logs.");
    }
    Dom.ocupado(this.btnAtualizar, false);
  }

  #filtrar() {
    const termo = this.filtro.value.trim().toLowerCase();
    const visiveis = this.registros.filter((r) => r.contem(termo));
    Dom.texto("#total-auditoria", `${visiveis.length} de ${this.registros.length} registros`);
    this.lista.renderizar(visiveis);
  }
}
