// Integrantes do grupo com avatar, presença online e ação de remover

import { Lista } from "./Lista.js";
import { ItemLista } from "./ItemLista.js";
import { Botao } from "./Botao.js";
import { Icones } from "../nucleo/Icones.js";

export class ListaIntegrantes extends Lista {
  constructor(elemento, { perfis, presenca, aoRemover }) {
    super(elemento);
    this.perfis = perfis;
    this.presenca = presenca;
    this.aoRemover = aoRemover;
    this.cancelamentos = [];
  }

  renderizar(grupo, sessao) {
    this.cancelamentos.forEach((cancelar) => cancelar());
    this.cancelamentos = [];
    this.limpar();

    const ehProprietario = grupo.ehProprietario(sessao.uid);
    for (const uid of grupo.members) {
      const souEu = uid === sessao.uid;
      const item = new ItemLista();
      const img = item.avatar();
      const nome = item.nome(souEu ? sessao.perfil.username : "carregando…");

      const meta = item.meta("", "d-flex align-items-center gap-2");
      const ponto = document.createElement("span");
      ponto.className = "ph-dot";
      const estado = document.createElement("span");
      estado.textContent = "offline";
      meta.append(ponto, estado, document.createTextNode(uid === grupo.ownerId ? "· proprietário" : ""));

      if (ehProprietario && !souEu) {
        item.acao(Botao.comIcone("Remover", "user-minus", "btn-outline-secondary", (b) => this.aoRemover(uid, b)));
      }
      this.adicionar(item);

      if (souEu) {
        img.src = sessao.perfil.avatar.url;
      } else {
        this.perfis.carregar(uid).then((perfil) => {
          if (!perfil) { nome.textContent = "usuário removido"; return; }
          nome.textContent = perfil.username;
          img.src = perfil.avatar.url;
        }).catch(() => { nome.textContent = "indisponível"; });
      }

      this.cancelamentos.push(this.presenca.observar(uid, (online) => {
        ponto.classList.toggle("ph-dot--on", online);
        estado.textContent = online ? "online" : "offline";
      }));
    }
    Icones.renderizar();
  }
}
