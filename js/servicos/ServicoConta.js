// Conta do usuário: senha e exclusão definitiva

import { Api } from "../nucleo/Api.js";

export class ServicoConta {
  static CANCELADO = "cancelado";

  constructor(usuario) {
    this.usuario = usuario;
  }

  get usaSenha() {
    return this.usuario.usaSenha;
  }

  resumo(perfil) {
    return [
      ["Username", perfil.username],
      ["E-mail", this.usuario.email || "—"],
      ["Forma de login", "E-mail e senha"],
      ["Conta criada em", this.usuario.criadoEm ? new Date(this.usuario.criadoEm).toLocaleString("pt-BR") : "—"]
    ];
  }

  #pedirSenha() {
    const senha = prompt("Por segurança, digite sua senha para continuar:");
    if (!senha) throw new Error(ServicoConta.CANCELADO);
    return senha;
  }

  enviarTrocaSenha() {
    return Api.post("/auth/password/forgot", { email: this.usuario.email });
  }

  // O servidor transfere ou apaga os grupos, remove convites e exclui a conta
  async excluir() {
    await Api.excluir("/users/me", { password: this.#pedirSenha() });
    Api.esquecerToken();
  }
}
