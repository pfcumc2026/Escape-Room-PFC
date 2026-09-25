// Grupo de jogadores (groups/{gid})

import { Limites } from "../nucleo/Limites.js";

export class Grupo {
  static ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";

  constructor(id, dados = {}) {
    this.id = id;
    this.name = dados.name || "";
    this.ownerId = dados.ownerId || "";
    this.members = dados.members || [];
    this.memberCount = dados.memberCount || 0;
    this.maxMembers = dados.maxMembers || Limites.maxIntegrantes;
    this.inviteCode = dados.inviteCode || "";
    this.createdAt = dados.createdAt || null;
  }

  static deSnapshot(snap) {
    return snap.exists() ? new Grupo(snap.id, snap.data()) : null;
  }

  static novoCodigo() {
    const valores = crypto.getRandomValues(new Uint8Array(8));
    return Array.from(valores, (v) => Grupo.ALFABETO[v % Grupo.ALFABETO.length]).join("");
  }

  static idValido(id) {
    return /^[A-Za-z0-9_-]{6,40}$/.test(id);
  }

  static codigoValido(codigo) {
    return /^[a-z0-9]{8}$/.test(codigo);
  }

  get criadoEm() {
    return this.createdAt?.seconds || 0;
  }

  get cheio() {
    return this.memberCount >= Limites.maxIntegrantes;
  }

  contem(uid) {
    return this.members.includes(uid);
  }

  ehProprietario(uid) {
    return this.ownerId === uid;
  }

  papel(uid) {
    return this.ehProprietario(uid) ? "você é o proprietário" : "integrante";
  }

  resumo(uid) {
    return `${this.memberCount} de ${Limites.maxIntegrantes} jogadores · ${this.papel(uid)}`;
  }

  linkConvite() {
    const url = new URL("entrar.html", location.href);
    url.searchParams.set("g", this.id);
    url.searchParams.set("c", this.inviteCode);
    return url.href;
  }
}
