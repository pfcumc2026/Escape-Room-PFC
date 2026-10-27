// Conta autenticada (GET /api/users/me): dados da conta somados ao perfil público

import { Perfil } from "./Perfil.js";

export class Usuario {
  constructor(dados = {}) {
    this.uid = dados.uid;
    this.email = dados.email || "";
    this.nome = dados.name || "";
    this.emailVerified = !!dados.emailVerified;
    this.admin = !!dados.admin;
    this.usaSenha = !!dados.hasPassword;
    this.googleVinculado = !!dados.googleLinked;
    this.segundoFatorAtivo = !!dados.twoFactorEnabled;
    this.codigosRestantes = dados.recoveryCodesLeft || 0;
    this.criadoEm = dados.createdAt || null;
    this.perfil = Perfil.deDados(dados.profile);
  }
}
