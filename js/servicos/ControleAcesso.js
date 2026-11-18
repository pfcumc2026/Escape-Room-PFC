// Controle de acesso das páginas e roteamento após o login

import { ServicoAutenticacao } from "./ServicoAutenticacao.js";
import { Sessao } from "../modelos/Sessao.js";

export class ControleAcesso {
  static DESTINO_VALIDO = /^[a-z-]+\.html(\?[\w=&%.-]*)?$/;

  constructor(autenticacao = new ServicoAutenticacao()) {
    this.autenticacao = autenticacao;
  }

  // Retorna a sessão ou null quando já está redirecionando
  async exigirAutenticacao({ exigirPerfil = true, exigirAdmin = false } = {}) {
    const usuario = await this.autenticacao.usuarioAtual();
    if (!usuario) { location.replace("login.html"); return null; }
    if (!usuario.emailVerified) { location.replace("verificar-email.html"); return null; }

    const sessao = new Sessao(usuario, usuario.perfil);
    if (exigirPerfil && !sessao.perfilCompleto) { location.replace("perfil.html"); return null; }
    if (exigirAdmin && !usuario.admin) { location.replace("dashboard.html"); return null; }
    return sessao;
  }

  async redirecionarSeLogado() {
    const usuario = await this.autenticacao.usuarioAtual();
    if (usuario && usuario.emailVerified) {
      location.replace(usuario.perfil?.completo ? "dashboard.html" : "perfil.html");
      return true;
    }
    if (usuario && !usuario.emailVerified) { location.replace("verificar-email.html"); return true; }
    return false;
  }

  async rotearAposLogin(usuario) {
    if (!usuario.emailVerified) { location.replace("verificar-email.html"); return; }
    const destino = new URLSearchParams(location.search).get("proximo");
    if (usuario.perfil?.completo) {
      location.replace(destino && ControleAcesso.DESTINO_VALIDO.test(destino) ? destino : "dashboard.html");
    } else {
      location.replace("perfil.html");
    }
  }

  async sair() {
    try { await this.autenticacao.sair(); } finally { location.replace("login.html"); }
  }
}
