// Registros de auditoria exibidos ao administrador

import { Lista } from "./Lista.js";
import { ItemLista } from "./ItemLista.js";

export class ListaAuditoria extends Lista {
  renderizar(registros) {
    this.limpar();
    if (!registros.length) {
      this.vazio("Nenhum registro encontrado.");
      return;
    }
    registros.forEach((registro) => {
      const item = new ItemLista();
      item.nome(`${registro.rotulo} · ${registro.email || registro.uid}`);
      item.meta(`${registro.dataFormatada} · uid ${registro.uid}`);
      if (registro.detail) item.meta(registro.detail);
      this.adicionar(item);
    });
  }
}
