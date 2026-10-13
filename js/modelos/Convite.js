// Convite para um grupo (GET /api/invites)

export class Convite {
  static ROTULOS = { pending: "aguardando resposta", accepted: "aceito", declined: "recusado" };

  constructor(id, dados = {}) {
    this.id = id;
    this.groupId = dados.groupId || "";
    this.groupName = dados.groupName || "";
    this.fromUid = dados.fromUid || "";
    this.fromUsername = dados.fromUsername || "";
    this.toUid = dados.toUid || "";
    this.toUsername = dados.toUsername || "";
    this.status = dados.status || "";
  }

  static deDados(dados) {
    return new Convite(dados.id, dados);
  }

  static idPara(idGrupo, uid) {
    return `${idGrupo}_${uid}`;
  }

  get pendente() {
    return this.status === "pending";
  }

  get rotuloStatus() {
    return Convite.ROTULOS[this.status] || this.status;
  }
}
