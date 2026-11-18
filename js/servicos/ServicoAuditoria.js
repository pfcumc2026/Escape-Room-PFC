// Consulta dos logs de auditoria; os registros são gravados pelo próprio servidor a cada ação

import { Api } from "../nucleo/Api.js";
import { RegistroAuditoria } from "../modelos/RegistroAuditoria.js";

export class ServicoAuditoria {
  async listar(maximo = 300) {
    const registros = await Api.get(`/audit?limit=${maximo}`);
    return registros.map((r) => RegistroAuditoria.deDados(r));
  }
}
