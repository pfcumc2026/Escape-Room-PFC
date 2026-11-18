// Envio, resposta e acompanhamento dos convites

import { Api } from "../nucleo/Api.js";
import { tempoReal } from "../nucleo/TempoReal.js";
import { Convite } from "../modelos/Convite.js";

export class ServicoConvites {
  #observar(caminho, aoAtualizar, aoFalhar) {
    return tempoReal.observar(
      "convites",
      async () => (await Api.get(caminho)).map((d) => Convite.deDados(d)),
      aoAtualizar,
      aoFalhar
    );
  }

  observarRecebidos(uid, aoAtualizar, aoFalhar) {
    return this.#observar("/invites/received", aoAtualizar, aoFalhar);
  }

  observarEnviados(uid, aoAtualizar, aoFalhar) {
    return this.#observar("/invites/sent", aoAtualizar, aoFalhar);
  }

  observarPendentesDoGrupo(idGrupo, uid, aoAtualizar, aoFalhar) {
    return this.#observar(`/groups/${encodeURIComponent(idGrupo)}/invites`, aoAtualizar, aoFalhar);
  }

  // Usuário inexistente, convite repetido ou grupo cheio voltam como erro com a mensagem do servidor
  enviar({ grupo, alvo }) {
    return Api.post(`/groups/${encodeURIComponent(grupo.id)}/invites`, { username: alvo });
  }

  responder(convite, aceitar) {
    return Api.post(`/invites/${encodeURIComponent(convite.id)}/response`, { accept: aceitar });
  }

  cancelar(id) {
    return Api.excluir(`/invites/${encodeURIComponent(id)}`);
  }
}
