// Ponto de entrada único: instancia a página declarada em data-pagina

export class Aplicacao {
  static PAGINAS = {
    inicial: "PaginaInicial",
    login: "PaginaLogin",
    cadastro: "PaginaCadastro",
    "esqueci-senha": "PaginaEsqueciSenha",
    "verificar-email": "PaginaVerificarEmail",
    perfil: "PaginaPerfil",
    dashboard: "PaginaDashboard",
    grupo: "PaginaGrupo",
    entrar: "PaginaEntrar",
    configuracoes: "PaginaConfiguracoes",
    auditoria: "PaginaAuditoria",
    termos: "PaginaDocumento",
    privacidade: "PaginaDocumento"
  };

  static async iniciar() {
    const classe = Aplicacao.PAGINAS[document.body.dataset.pagina];
    if (!classe) return;
    const modulo = await import(`./paginas/${classe}.js`);
    await new modulo[classe]().iniciar();
  }
}

await Aplicacao.iniciar();
