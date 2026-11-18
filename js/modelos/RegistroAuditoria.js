// Registro de auditoria (GET /api/audit)

export class RegistroAuditoria {
  static ROTULOS = {
    cadastro: "Cadastro de conta",
    termos_aceitos: "Aceite dos termos",
    login: "Login",
    email_verificado: "E-mail verificado",
    conta_migrada: "Conta migrada do Firebase",
    google_vinculado: "Google vinculado",
    senha_redefinida: "Senha redefinida",
    sala_salva: "Sala salva",
    logout: "Logout",
    perfil_criado: "Perfil criado",
    perfil_atualizado: "Perfil atualizado",
    grupo_criado: "Grupo criado",
    grupo_excluido: "Grupo excluído",
    grupo_entrada: "Entrada em grupo",
    grupo_saida: "Saída de grupo",
    integrante_removido: "Integrante removido",
    codigo_renovado: "Código de convite renovado",
    convite_enviado: "Convite enviado",
    convite_aceito: "Convite aceito",
    convite_recusado: "Convite recusado",
    convite_cancelado: "Convite cancelado",
    "2fa_ativado": "2FA ativado",
    "2fa_desativado": "2FA desativado",
    troca_senha: "Redefinição de senha solicitada",
    conta_excluida: "Conta excluída"
  };

  constructor(dados = {}) {
    this.uid = dados.uid || "";
    this.email = dados.email || "";
    this.action = dados.action || "";
    this.detail = dados.detail || "";
    this.at = dados.at || null;
  }

  static deDados(dados) {
    return new RegistroAuditoria(dados);
  }

  get rotulo() {
    return RegistroAuditoria.ROTULOS[this.action] || this.action;
  }

  get dataFormatada() {
    return this.at ? new Date(this.at).toLocaleString("pt-BR") : "—";
  }

  contem(termo) {
    return [this.email, this.uid, this.rotulo, this.detail].join(" ").toLowerCase().includes(termo);
  }
}
