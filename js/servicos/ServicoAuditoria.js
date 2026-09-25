// Gravação e consulta dos logs de auditoria

import { firebase } from "../nucleo/Firebase.js";
import {
  collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { RegistroAuditoria } from "../modelos/RegistroAuditoria.js";

export class ServicoAuditoria {
  static MAX_DETALHE = 200;

  constructor(nucleo = firebase) {
    this.db = nucleo.db;
    this.auth = nucleo.auth;
  }

  // Uma falha no log não interrompe a ação do usuário
  async registrar(acao, detalhe = "") {
    const usuario = this.auth.currentUser;
    if (!usuario) return;
    try {
      await addDoc(collection(this.db, "auditLogs"), {
        uid: usuario.uid,
        email: usuario.email || "",
        action: acao,
        detail: String(detalhe).slice(0, ServicoAuditoria.MAX_DETALHE),
        at: serverTimestamp()
      });
    } catch (e) {
      console.warn("[Placeholder] auditoria", e);
    }
  }

  async listar(maximo = 300) {
    const snap = await getDocs(query(collection(this.db, "auditLogs"), orderBy("at", "desc"), limit(maximo)));
    return snap.docs.map((d) => RegistroAuditoria.deSnapshot(d));
  }
}
