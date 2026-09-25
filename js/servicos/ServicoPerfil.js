// Leitura e gravação do perfil e da reserva de username

import { firebase } from "../nucleo/Firebase.js";
import {
  doc, getDoc, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { Perfil } from "../modelos/Perfil.js";
import { Texto } from "../nucleo/Texto.js";
import { ServicoAuditoria } from "./ServicoAuditoria.js";

export class ServicoPerfil {
  constructor(nucleo = firebase, auditoria = new ServicoAuditoria(nucleo)) {
    this.db = nucleo.db;
    this.auditoria = auditoria;
  }

  async carregar(uid) {
    return Perfil.deSnapshot(await getDoc(doc(this.db, "users", uid)));
  }

  async nomePrivado(uid) {
    const snap = await getDoc(doc(this.db, "users", uid, "private", "profile"));
    return snap.exists() ? snap.data().name : "";
  }

  async uidPorUsername(usernameLower) {
    const snap = await getDoc(doc(this.db, "usernames", usernameLower));
    return snap.exists() ? snap.data().uid : null;
  }

  // O perfil de administrador é concedido apenas pelo console (admins/{uid})
  async ehAdministrador(uid) {
    const snap = await getDoc(doc(this.db, "admins", uid));
    return snap.exists();
  }

  async usernameLivre(usernameLower) {
    const snap = await getDoc(doc(this.db, "usernames", usernameLower));
    return !snap.exists();
  }

  // Reserva do username e gravação do perfil acontecem na mesma transação
  async salvar({ uid, username, estilo, semente, perfil, nomeExibicao }) {
    const minusculo = username.toLowerCase();
    const anterior = perfil?.usernameLower || null;

    const lote = writeBatch(this.db);
    if (minusculo !== anterior) {
      lote.set(doc(this.db, "usernames", minusculo), { uid });
      if (anterior) lote.delete(doc(this.db, "usernames", anterior));
    }

    const dados = {
      username,
      usernameLower: minusculo,
      avatarStyle: estilo,
      avatarSeed: semente,
      profileComplete: true,
      createdAt: perfil?.createdAt || serverTimestamp()
    };
    if (perfil?.lastGroupAt) dados.lastGroupAt = perfil.lastGroupAt;

    lote.set(doc(this.db, "users", uid), dados);
    lote.set(doc(this.db, "users", uid, "private", "profile"), {
      name: Texto.limpar(nomeExibicao, 60)
    });

    await lote.commit();
    await this.auditoria.registrar(perfil ? "perfil_atualizado" : "perfil_criado", `username: ${username}`);
  }
}
