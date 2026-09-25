// Convites recebidos, com as ações de aceitar e recusar

import { Lista } from "./Lista.js";
import { ItemLista } from "./ItemLista.js";
import { Botao } from "./Botao.js";

export class ListaConvites extends Lista {
  constructor(elemento, aoResponder) {
    super(elemento);
    this.aoResponder = aoResponder;
  }

  renderizar(convites) {
    this.limpar();
    if (!convites.length) {
      this.vazio("Nenhum convite pendente.");
      return;
    }
    convites.forEach((convite) => {
      const item = new ItemLista();
      item.nome(convite.groupName);
      item.meta(`convite de ${convite.fromUsername}`);
      item.acao(Botao.simples("Aceitar", "btn-primary", (b) => this.aoResponder(convite, true, b)));
      item.acao(Botao.simples("Recusar", "btn-outline-secondary", (b) => this.aoResponder(convite, false, b)));
      this.adicionar(item);
    });
  }
}
