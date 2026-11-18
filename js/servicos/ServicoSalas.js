// Configuração administrativa das salas (GET/PUT /api/rooms/{id})

import { Api } from "../nucleo/Api.js";
import { Sala } from "../modelos/Sala.js";
import { Hotspot } from "../modelos/Hotspot.js";
import { ErroApp } from "../nucleo/ErroApp.js";

export class ServicoSalas {
  static SALA_INICIAL = "sala-gotica";

  // Sala distribuída com o projeto: serve de ponto de partida e de alternativa
  async carregarPadrao(id) {
    const resposta = await fetch(new URL(`assets/salas/${encodeURIComponent(id)}.json`, document.baseURI));
    if (!resposta.ok) throw new ErroApp("Não foi possível carregar a sala padrão.");
    return Sala.deDados(await resposta.json());
  }

  async #carregarPublicada(id, { incluirRascunho }) {
    let dados;
    try {
      dados = await Api.get(`/rooms/${encodeURIComponent(id)}${incluirRascunho ? "?draft=1" : ""}`);
    } catch (e) {
      if (e.status === 404) return null;
      throw e;
    }
    // Salas salvas antes da navegação por setas não têm ligações: vale a sala padrão
    if (!dados.renders?.some((r) => r.ligacoes?.length)) return null;
    return new Sala({
      id, nome: dados.nome, descricao: dados.descricao, renders: dados.renders, mapa: dados.mapa || null, publicada: !!dados.publicada,
      hotspots: dados.hotspots.map((h) => new Hotspot(h))
    });
  }

  // Uma sala salva que não tem todos os pontos de vista da sala padrão é de uma versão antiga e fica de lado
  async #maisRecente(salvo, id) {
    const padrao = await this.carregarPadrao(id);
    return salvo && padrao.renders.every((r) => salvo.render(r.id)) ? salvo : padrao;
  }

  // Jogadores recebem a versão publicada; sem ela, vale a sala padrão
  async carregar(id) {
    try {
      return await this.#maisRecente(await this.#carregarPublicada(id, { incluirRascunho: false }), id);
    } catch {
      return this.carregarPadrao(id);
    }
  }

  // O editor mostra o rascunho salvo, se existir
  async carregarParaEdicao(id) {
    return this.#maisRecente(await this.#carregarPublicada(id, { incluirRascunho: true }), id);
  }

  // A sala é gravada inteira: hotspots removidos no editor deixam de existir no servidor
  async salvar(sala) {
    const invalido = sala.validar();
    if (invalido) throw new ErroApp(invalido);
    await Api.put(`/rooms/${encodeURIComponent(sala.id)}`, {
      nome: sala.nome, descricao: sala.descricao, renders: sala.renders.map((r) => r.paraDados()),
      mapa: sala.mapa, publicada: sala.publicada, hotspots: sala.hotspots.map((h) => h.paraDados())
    });
  }
}
