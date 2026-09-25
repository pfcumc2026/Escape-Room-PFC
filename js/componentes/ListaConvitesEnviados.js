// Convites que o usuário enviou e o status de cada um

import { Lista } from "./Lista.js";
import { ItemLista } from "./ItemLista.js";

export class ListaConvitesEnviados extends Lista {
  static MAXIMO = 12;

  renderizar(convites) {
    this.limpar();
    if (!convites.length) {
      this.vazio("Você ainda não enviou convites.");
      return;
    }
    convites.slice(0, ListaConvitesEnviados.MAXIMO).forEach((convite) => {
      const item = new ItemLista();
      item.nome(convite.toUsername);
      item.meta(`${convite.groupName} · ${convite.rotuloStatus}`);
      this.adicionar(item);
    });
  }
}
