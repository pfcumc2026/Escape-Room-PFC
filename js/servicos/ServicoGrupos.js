// Criação, leitura e manutenção dos grupos

import { Api } from "../nucleo/Api.js";
import { tempoReal } from "../nucleo/TempoReal.js";
import { Grupo } from "../modelos/Grupo.js";

export class ServicoGrupos {
  #caminho(id) {
    return `/groups/${encodeURIComponent(id)}`;
  }

  observarDoUsuario(uid, aoAtualizar, aoFalhar) {
    return tempoReal.observar(
      "grupos",
      async () => (await Api.get("/groups")).map((d) => Grupo.deDados(d)),
      aoAtualizar,
      aoFalhar
    );
  }

  // Emite null quando o grupo deixa de existir; sem permissão, chama aoFalhar
  observar(id, aoAtualizar, aoFalhar) {
    return tempoReal.observar(`grupo:${id}`, () => this.carregar(id), aoAtualizar, aoFalhar);
  }

  async carregar(id) {
    try {
      return Grupo.deDados(await Api.get(this.#caminho(id)));
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async criar(uid, nome) {
    const grupo = await Api.post("/groups", { name: nome });
    return grupo.id;
  }

  removerIntegrante(id, uid) {
    return Api.excluir(`${this.#caminho(id)}/members/${encodeURIComponent(uid)}`);
  }

  sair(id, uid) {
    return this.removerIntegrante(id, uid);
  }

  async renovarCodigo(id) {
    const { inviteCode } = await Api.post(`${this.#caminho(id)}/invite-code`);
    return inviteCode;
  }

  entrarComCodigo(id, uid, codigo) {
    return Api.post(`${this.#caminho(id)}/join`, { code: codigo });
  }

  excluir(grupo) {
    return Api.excluir(this.#caminho(grupo.id));
  }
}
