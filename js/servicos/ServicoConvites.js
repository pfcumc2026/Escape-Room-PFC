// Envio, resposta e acompanhamento dos convites

import { firebase } from "../nucleo/Firebase.js";
import {
  collection, doc, query, where, onSnapshot, getDoc, setDoc, deleteDoc,
  writeBatch, serverTimestamp, arrayUnion, increment
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { Convite } from "../modelos/Convite.js";
import { ErroApp } from "../nucleo/ErroApp.js";
import { ServicoPerfil } from "./ServicoPerfil.js";
import { ServicoAuditoria } from "./ServicoAuditoria.js";

export class ServicoConvites {
  constructor(nucleo = firebase, perfis = new ServicoPerfil(nucleo), auditoria = new ServicoAuditoria(nucleo)) {
    this.db = nucleo.db;
    this.perfis = perfis;
    this.auditoria = auditoria;
  }

  #referencia(id) {
    return doc(this.db, "invites", id);
  }

  #observar(consulta, aoAtualizar, aoFalhar) {
    return onSnapshot(consulta, (snap) => aoAtualizar(snap.docs.map((d) => Convite.deSnapshot(d))), aoFalhar);
  }

  observarRecebidos(uid, aoAtualizar, aoFalhar) {
    return this.#observar(
      query(collection(this.db, "invites"), where("toUid", "==", uid), where("status", "==", "pending")),
      aoAtualizar, aoFalhar
    );
  }

  observarEnviados(uid, aoAtualizar, aoFalhar) {
    return this.#observar(
      query(collection(this.db, "invites"), where("fromUid", "==", uid)),
      aoAtualizar, aoFalhar
    );
  }

  observarPendentesDoGrupo(idGrupo, uid, aoAtualizar, aoFalhar) {
    return this.#observar(
      query(collection(this.db, "invites"),
        where("groupId", "==", idGrupo),
        where("fromUid", "==", uid),
        where("status", "==", "pending")),
      aoAtualizar, aoFalhar
    );
  }

  async enviar({ grupo, remetente, alvo }) {
    const uidAlvo = await this.perfis.uidPorUsername(alvo);
    if (!uidAlvo) throw new ErroApp("Usuário não encontrado.");
    if (grupo.contem(uidAlvo)) throw new ErroApp("Este usuário já está no grupo.");

    const perfilAlvo = await this.perfis.carregar(uidAlvo);
    const id = Convite.idPara(grupo.id, uidAlvo);
    const existente = await getDoc(this.#referencia(id));
    if (existente.exists()) {
      if (existente.data().status === "pending") {
        throw new ErroApp("Já existe um convite pendente para este usuário.", { tipo: "info" });
      }
      await deleteDoc(this.#referencia(id));
    }

    await setDoc(this.#referencia(id), {
      groupId: grupo.id,
      groupName: grupo.name,
      fromUid: remetente.uid,
      fromUsername: remetente.username,
      toUid: uidAlvo,
      toUsername: perfilAlvo ? perfilAlvo.username : alvo,
      status: "pending",
      createdAt: serverTimestamp()
    });
    await this.auditoria.registrar("convite_enviado", `${alvo} para o grupo ${grupo.name} (${grupo.id})`);
  }

  async responder(convite, aceitar, uid) {
    const lote = writeBatch(this.db);
    lote.update(this.#referencia(convite.id), {
      status: aceitar ? "accepted" : "declined",
      respondedAt: serverTimestamp()
    });
    if (aceitar) {
      lote.update(doc(this.db, "groups", convite.groupId), {
        members: arrayUnion(uid),
        memberCount: increment(1)
      });
    }
    await lote.commit();
    await this.auditoria.registrar(aceitar ? "convite_aceito" : "convite_recusado", `grupo ${convite.groupName} (${convite.groupId})`);
  }

  async cancelar(id) {
    await deleteDoc(this.#referencia(id));
    await this.auditoria.registrar("convite_cancelado", `convite ${id}`);
  }
}
