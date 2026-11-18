// Chat do grupo; o intervalo entre mensagens e o limite por minuto são aplicados pelo servidor

import { Api } from "../nucleo/Api.js";
import { tempoReal } from "../nucleo/TempoReal.js";
import { Mensagem } from "../modelos/Mensagem.js";

export class ServicoChat {
  #caminho(idGrupo) {
    return `/groups/${encodeURIComponent(idGrupo)}/messages`;
  }

  observar(idGrupo, aoAtualizar, aoFalhar) {
    return tempoReal.observar(
      `chat:${idGrupo}`,
      () => Api.get(this.#caminho(idGrupo)),
      (lista) => {
        const agora = Date.now();
        aoAtualizar(lista.map((d) => Mensagem.deDados(d)).filter((m) => m.valida(agora)), agora);
      },
      aoFalhar
    );
  }

  enviar(idGrupo, autor, texto) {
    return Api.post(this.#caminho(idGrupo), { text: texto });
  }
}
