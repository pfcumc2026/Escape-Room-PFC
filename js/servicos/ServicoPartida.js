// Estado compartilhado da partida no Firestore (games/{gid}); o relógio do servidor vem do Realtime Database

import { firebase } from "../nucleo/Firebase.js";
import {
  collection, doc, onSnapshot, setDoc, updateDoc, getDocs, writeBatch,
  serverTimestamp, arrayUnion, Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";
import { EstadoPartida } from "../modelos/EstadoPartida.js";
import { Dificuldade } from "../modelos/Dificuldade.js";

export class ServicoPartida {
  constructor(nucleo = firebase) {
    this.db = nucleo.db;
    this.rtdb = nucleo.rtdb;
  }

  referencia(gid) {
    return doc(this.db, "games", gid);
  }

  // Diferença entre o relógio do servidor e o do computador do jogador
  deslocamentoMs() {
    return new Promise((resolve) => {
      const limite = setTimeout(() => resolve(0), 4000);
      onValue(ref(this.rtdb, ".info/serverTimeOffset"), (snap) => {
        clearTimeout(limite);
        resolve(Number(snap.val()) || 0);
      }, () => { clearTimeout(limite); resolve(0); }, { onlyOnce: true });
    });
  }

  // Emite null quando não há partida e um EstadoPartida quando há
  observar(gid, aoMudar, aoFalhar) {
    const opcoes = { serverTimestamps: "estimate" };
    let principal;
    let achadas = {};
    let resolvidas = {};
    const carregado = { principal: false, achadas: false, resolvidas: false };

    const emitir = () => {
      if (!carregado.principal || !carregado.achadas || !carregado.resolvidas) return;
      aoMudar(principal ? EstadoPartida.deFirestore(gid, principal, achadas, resolvidas) : null);
    };
    const mapa = (snap) => Object.fromEntries(snap.docs.map((d) => [d.id, d.data(opcoes)]));

    const cancelar = [
      onSnapshot(this.referencia(gid), (snap) => {
        principal = snap.exists() ? snap.data(opcoes) : null;
        carregado.principal = true;
        emitir();
      }, aoFalhar),
      onSnapshot(collection(this.db, "games", gid, "found"), (snap) => {
        achadas = mapa(snap);
        carregado.achadas = true;
        emitir();
      }, aoFalhar),
      onSnapshot(collection(this.db, "games", gid, "solved"), (snap) => {
        resolvidas = mapa(snap);
        carregado.resolvidas = true;
        emitir();
      }, aoFalhar)
    ];
    return () => cancelar.forEach((c) => c());
  }

  async criar(gid, { uid, dificuldade, semente, config }) {
    await setDoc(this.referencia(gid), {
      groupId: gid,
      ownerId: uid,
      difficulty: dificuldade,
      seed: semente,
      status: EstadoPartida.STATUS.ESPERA,
      players: [uid],
      config,
      createdAt: serverTimestamp()
    });
  }

  async entrar(gid, uid) {
    await updateDoc(this.referencia(gid), { players: arrayUnion(uid) });
  }

  async iniciar(gid, dificuldade, deslocamentoMs) {
    const expiraEm = Date.now() + deslocamentoMs + Dificuldade.duracaoMs(dificuldade);
    await updateDoc(this.referencia(gid), {
      status: EstadoPartida.STATUS.JOGANDO,
      startedAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(expiraEm)
    });
  }

  async registrarPista(gid, objetoId, uid) {
    await setDoc(doc(this.db, "games", gid, "found", objetoId), { by: uid, at: serverTimestamp() });
  }

  async registrarResolucao(gid, chave, { uid, dicas, tentativas }) {
    await setDoc(doc(this.db, "games", gid, "solved", chave), {
      by: uid, at: serverTimestamp(), hints: dicas, attempts: tentativas
    });
  }

  // O último enigma e a conclusão da partida são gravados juntos
  async concluir(gid, chave, { uid, dicas, tentativas }, pontos) {
    const lote = writeBatch(this.db);
    lote.set(doc(this.db, "games", gid, "solved", chave), {
      by: uid, at: serverTimestamp(), hints: dicas, attempts: tentativas
    });
    lote.update(this.referencia(gid), {
      status: EstadoPartida.STATUS.CONCLUIDA, finishedAt: serverTimestamp(), score: pontos
    });
    await lote.commit();
  }

  async encerrar(gid, status) {
    await updateDoc(this.referencia(gid), { status, finishedAt: serverTimestamp() });
  }

  async reiniciar(gid) {
    const lote = writeBatch(this.db);
    for (const sub of ["found", "solved"]) {
      const lista = await getDocs(collection(this.db, "games", gid, sub));
      lista.docs.forEach((d) => lote.delete(d.ref));
    }
    lote.delete(this.referencia(gid));
    await lote.commit();
  }
}
