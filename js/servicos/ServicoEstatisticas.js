import { Api } from "../nucleo/Api.js";

export class ServicoEstatisticas {
  obter() {
    return Api.get("/users/me/stats");
  }
}
