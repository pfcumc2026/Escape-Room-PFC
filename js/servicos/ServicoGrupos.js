// Criação, leitura e manutenção dos grupos

import { firebase } from "../nucleo/Firebase.js";
import {
  collection, doc, query, where, limit, onSnapshot, getDoc, getDocs,
  writeBatch, updateDoc, deleteDoc, serverTimestamp, arrayUnion, arrayRemove, increment
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { Grupo } from "../modelos/Grupo.js";
import { Limites } from "../nucleo/Limites.js";
import { ServicoAuditoria } from "./ServicoAuditoria.js";

export class ServicoGrupos {
  constructor(nucleo = firebase, auditoria = new ServicoAuditoria(nucleo)) {
    this.db = nucleo.db;
    this.auditoria = auditoria;
  }

  referencia(id) {
    return doc(this.db, "groups", id);
  }

  observarDoUsuario(uid, aoAtualizar, aoFalhar) {
    return onSnapshot(
      query(collection(this.db, "groups"), where("members", "array-contains", uid)),
      (snap) => aoAtualizar(snap.docs
        .map((d) => new Grupo(d.id, d.data()))
        .sort((a, b) => b.criadoEm - a.criadoEm)),
      aoFalhar
    );
  }

  observar(id, aoAtualizar, aoFalhar) {
    return onSnapshot(this.referencia(id), (snap) => aoAtualizar(Grupo.deSnapshot(snap)), aoFalhar);
  }

  async carregar(id) {
    return Grupo.deSnapshot(await getDoc(this.referencia(id)));
  }

  async criar(uid, nome) {
    const ref = doc(collection(this.db, "groups"));
    const lote = writeBatch(this.db);
    lote.set(ref, {
      name: nome,
      ownerId: uid,
      members: [uid],
      memberCount: 1,
      maxMembers: Limites.maxIntegrantes,
      inviteCode: Grupo.novoCodigo(),
      createdAt: serverTimestamp()
    });
    lote.update(doc(this.db, "users", uid), { lastGroupAt: serverTimestamp() });
    await lote.commit();
    await this.auditoria.registrar("grupo_criado", `${nome} (${ref.id})`);
    return ref.id;
  }

  async removerIntegrante(id, uid) {
    await updateDoc(this.referencia(id), { members: arrayRemove(uid), memberCount: increment(-1) });
    await this.auditoria.registrar("integrante_removido", `grupo ${id}, usuário ${uid}`);
  }

  async sair(id, uid) {
    await updateDoc(this.referencia(id), { members: arrayRemove(uid), memberCount: increment(-1) });
    await this.auditoria.registrar("grupo_saida", `grupo ${id}`);
  }

  async renovarCodigo(id) {
    const codigo = Grupo.novoCodigo();
    await updateDoc(this.referencia(id), { inviteCode: codigo });
    await this.auditoria.registrar("codigo_renovado", `grupo ${id}`);
    return codigo;
  }

  // O código do convite é gravado junto com a entrada para as regras validarem
  async entrarComCodigo(id, uid, codigo) {
    const lote = writeBatch(this.db);
    lote.set(doc(this.db, "groups", id, "joins", uid), { code: codigo, at: serverTimestamp() });
    lote.update(this.referencia(id), { members: arrayUnion(uid), memberCount: increment(1) });
    await lote.commit();
    await this.auditoria.registrar("grupo_entrada", `grupo ${id} (link/QR Code)`);
  }

  async excluir(grupo, uid) {
    const msgs = await getDocs(query(collection(this.db, "groups", grupo.id, "messages"), limit(300)));
    for (let i = 0; i < msgs.docs.length; i += 200) {
      const lote = writeBatch(this.db);
      msgs.docs.slice(i, i + 200).forEach((d) => lote.delete(d.ref));
      await lote.commit();
    }

    const convites = await getDocs(query(collection(this.db, "invites"),
      where("groupId", "==", grupo.id), where("fromUid", "==", uid)));
    const lote = writeBatch(this.db);
    convites.docs.forEach((d) => lote.delete(d.ref));
    for (const membro of grupo.members) {
      lote.delete(doc(this.db, "groups", grupo.id, "rate", membro));
      lote.delete(doc(this.db, "groups", grupo.id, "joins", membro));
    }
    await lote.commit();
    await deleteDoc(this.referencia(grupo.id));
    await this.auditoria.registrar("grupo_excluido", `${grupo.name} (${grupo.id})`);
  }
}
