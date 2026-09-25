// Grupos dos quais o usuário participa

import { Lista } from "./Lista.js";
import { ItemLista } from "./ItemLista.js";
import { Botao } from "./Botao.js";

export class ListaGrupos extends Lista {
  renderizar(grupos, uid) {
    this.limpar();
    if (!grupos.length) {
      this.vazio("Você ainda não participa de nenhum grupo.");
      return;
    }
    grupos.forEach((grupo) => {
      const item = new ItemLista();
      item.nome(grupo.name);
      item.meta(grupo.resumo(uid));
      item.acao(Botao.link("Abrir", `grupo.html?id=${encodeURIComponent(grupo.id)}`, "btn-outline-secondary"));
      this.adicionar(item);
    });
  }
}
