// Conta do usuário: 2FA (TOTP), senha e exclusão definitiva

import { Api } from "../nucleo/Api.js";
import { ErroApp } from "../nucleo/ErroApp.js";

export class ServicoConta {
  static CANCELADO = "cancelado";

  constructor(usuario) {
    this.usuario = usuario;
  }

  get usaSenha() {
    return this.usuario.usaSenha;
  }

  get segundoFatorAtivo() {
    return this.usuario.segundoFatorAtivo;
  }

  resumo(perfil) {
    const formas = [this.usuario.usaSenha && "E-mail e senha", this.usuario.googleVinculado && "Google"].filter(Boolean);
    return [
      ["Username", perfil.username],
      ["E-mail", this.usuario.email || "—"],
      ["Forma de login", formas.join(", ") || "—"],
      ["Conta criada em", this.usuario.criadoEm ? new Date(this.usuario.criadoEm).toLocaleString("pt-BR") : "—"]
    ];
  }

  // Contas sem senha (somente Google) se reautenticam entrando de novo; o servidor confere o horário do login
  #pedirSenha() {
    if (!this.usaSenha) return undefined;
    const senha = prompt("Por segurança, digite sua senha para continuar:");
    if (!senha) throw new Error(ServicoConta.CANCELADO);
    return senha;
  }

  async #comReautenticacao(acao) {
    try {
      return await acao();
    } catch (e) {
      if (e.code === "REAUTENTICACAO_NECESSARIA") throw new ErroApp("Por segurança, saia e entre novamente com o Google para concluir esta ação.", { duracao: 7000 });
      throw e;
    }
  }

  gerarSegredo() {
    const senha = this.#pedirSenha();
    return this.#comReautenticacao(() => Api.post("/auth/2fa/setup", { password: senha }));
  }

  uriDoSegredo(segredo) {
    return segredo.uri;
  }

  // Retorna os códigos de recuperação, exibidos uma única vez
  async ativarSegundoFator(segredo, codigo) {
    const { recoveryCodes } = await Api.post("/auth/2fa/enable", { code: codigo });
    this.usuario.segundoFatorAtivo = true;
    this.usuario.codigosRestantes = recoveryCodes.length;
    return recoveryCodes;
  }

  // Exige um código do aplicativo: os códigos anteriores deixam de valer
  async gerarNovosCodigos() {
    const senha = this.#pedirSenha();
    const codigo = (prompt("Digite o código de 6 dígitos do aplicativo autenticador:") || "").replace(/\D/g, "");
    if (!codigo) throw new Error(ServicoConta.CANCELADO);
    const { recoveryCodes } = await this.#comReautenticacao(() => Api.post("/auth/2fa/recovery-codes", { password: senha, code: codigo }));
    this.usuario.codigosRestantes = recoveryCodes.length;
    return recoveryCodes;
  }

  async desativarSegundoFator() {
    const senha = this.#pedirSenha();
    const codigo = (prompt("Digite o código de 6 dígitos do aplicativo autenticador (ou um código de recuperação):") || "").trim();
    if (!codigo) throw new Error(ServicoConta.CANCELADO);
    const fator = /^\d{6}$/.test(codigo) ? { code: codigo } : { recoveryCode: codigo };
    await this.#comReautenticacao(() => Api.post("/auth/2fa/disable", { password: senha, ...fator }));
    this.usuario.segundoFatorAtivo = false;
  }

  enviarTrocaSenha() {
    return Api.post("/auth/password/forgot", { email: this.usuario.email });
  }

  // O servidor transfere ou apaga os grupos, remove convites e exclui a conta
  async excluir() {
    const senha = this.#pedirSenha();
    await this.#comReautenticacao(() => Api.excluir("/users/me", { password: senha }));
    Api.esquecerToken();
  }
}
