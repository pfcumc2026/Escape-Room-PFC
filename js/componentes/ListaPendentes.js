// Convites pendentes do grupo, visíveis para o proprietário

import { Lista } from "./Lista.js";
import { ItemLista } from "./ItemLista.js";
import { Botao } from "./Botao.js";

export class ListaPendentes extends Lista {
  constructor(elemento, aoCancelar) {
    super(elemento);
    this.aoCancelar = aoCancelar;
  }

  renderizar(convites) {
    this.limpar();
    convites.forEach((convite) => {
      const item = new ItemLista();
      item.nome(convite.toUsername);
      item.meta("convite pendente");
      item.acao(Botao.simples("Cancelar", "btn-outline-secondary", () => this.aoCancelar(convite)));
      this.adicionar(item);
    });
  }
}
