// Usuário autenticado somado ao seu perfil

export class Sessao {
  constructor(usuario, perfil) {
    this.usuario = usuario;
    this.perfil = perfil;
  }

  get uid() {
    return this.usuario.uid;
  }

  get perfilCompleto() {
    return !!(this.perfil && this.perfil.completo);
  }

  // Identificação usada como autor de mensagens e convites
  get autor() {
    return { uid: this.uid, username: this.perfil ? this.perfil.username : "" };
  }
}
