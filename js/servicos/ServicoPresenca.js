// Presença online: o jogador fica online enquanto alguma aba mantém a conexão de tempo real aberta

import { Api } from "../nucleo/Api.js";
import { tempoReal } from "../nucleo/TempoReal.js";

export class ServicoPresenca {
  iniciar() {
    tempoReal.conectar();
  }

  observar(uid, aoMudar) {
    return tempoReal.observar(
      `presenca:${uid}`,
      async () => (await Api.get(`/users/${encodeURIComponent(uid)}/presence`)).online,
      aoMudar
    );
  }
}
