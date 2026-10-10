// Configuração administrativa das salas (rooms/{id} e rooms/{id}/hotspots)

import { firebase } from "../nucleo/Firebase.js";
import {
  collection, doc, getDoc, getDocs, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { Sala } from "../modelos/Sala.js";
import { Hotspot } from "../modelos/Hotspot.js";
import { ErroApp } from "../nucleo/ErroApp.js";

export class ServicoSalas {
  static SALA_INICIAL = "sala-gotica";

  constructor(nucleo = firebase) {
    this.db = nucleo.db;
  }

  // Sala distribuída com o projeto: serve de ponto de partida e de alternativa
  async carregarPadrao(id) {
    const resposta = await fetch(new URL(`assets/salas/${encodeURIComponent(id)}.json`, document.baseURI));
    if (!resposta.ok) throw new ErroApp("Não foi possível carregar a sala padrão.");
    return Sala.deDados(await resposta.json());
  }

  async #carregarPublicada(id, { incluirRascunho }) {
    const snap = await getDoc(doc(this.db, "rooms", id));
    if (!snap.exists()) return null;
    const dados = snap.data();
    if (!dados.publicada && !incluirRascunho) return null;
    // Salas salvas antes da navegação por setas não têm ligações: vale a sala padrão
    if (!dados.renders?.some((r) => r.ligacoes?.length)) return null;
    const lista = await getDocs(collection(this.db, "rooms", id, "hotspots"));
    return new Sala({
      id, nome: dados.nome, descricao: dados.descricao, renders: dados.renders, mapa: dados.mapa || null, publicada: !!dados.publicada,
      hotspots: lista.docs.map((d) => Hotspot.deFirestore(d.data()))
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

  async salvar(sala, idsRemovidos = []) {
    const invalido = sala.validar();
    if (invalido) throw new ErroApp(invalido);

    const lote = writeBatch(this.db);
    lote.set(doc(this.db, "rooms", sala.id), {
      nome: sala.nome, descricao: sala.descricao, renders: sala.renders.map((r) => r.paraDados()),
      mapa: sala.mapa, publicada: sala.publicada, updatedAt: serverTimestamp()
    });
    idsRemovidos.forEach((id) => lote.delete(doc(this.db, "rooms", sala.id, "hotspots", id)));
    sala.hotspots.forEach((h) => lote.set(doc(this.db, "rooms", sala.id, "hotspots", h.id), h.paraFirestore()));
    await lote.commit();
  }

  async idsSalvos(id) {
    const lista = await getDocs(collection(this.db, "rooms", id, "hotspots"));
    return lista.docs.map((d) => d.id);
  }
}
