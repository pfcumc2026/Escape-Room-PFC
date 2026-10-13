// Leitura e gravação do perfil (username e avatar)

import { Api } from "../nucleo/Api.js";
import { Perfil } from "../modelos/Perfil.js";

export class ServicoPerfil {
  async carregar(uid) {
    try {
      return Perfil.deDados(await Api.get(`/users/${encodeURIComponent(uid)}`));
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async usernameLivre(usernameLower) {
    const { available } = await Api.get(`/users/username-available/${encodeURIComponent(usernameLower)}`);
    return available;
  }

  // A unicidade do username é garantida por um índice único no banco
  salvar({ username, estilo, semente }) {
    return Api.patch("/users/me", { username, avatarStyle: estilo, avatarSeed: semente });
  }
}
