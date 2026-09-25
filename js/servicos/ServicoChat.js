// Chat do grupo, com o contador de rate limit exigido pelas regras

import { firebase } from "../nucleo/Firebase.js";
import {
  collection, doc, query, orderBy, limit, onSnapshot, getDoc,
  writeBatch, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { Mensagem } from "../modelos/Mensagem.js";
import { Limites } from "../nucleo/Limites.js";
import { ErroApp } from "../nucleo/ErroApp.js";

export class ServicoChat {
  constructor(nucleo = firebase) {
    this.db = nucleo.db;
  }

  observar(idGrupo, aoAtualizar, aoFalhar) {
    return onSnapshot(
      query(collection(this.db, "groups", idGrupo, "messages"), orderBy("createdAt", "desc"), limit(60)),
      (snap) => {
        const agora = Date.now();
        const mensagens = snap.docs
          .map((d) => Mensagem.deSnapshot(d))
          .filter((m) => m.valida(agora))
          .reverse();
        aoAtualizar(mensagens, agora);
      },
      aoFalhar
    );
  }

  async enviar(idGrupo, autor, texto) {
    const refContador = doc(this.db, "groups", idGrupo, "rate", autor.uid);
    const atual = await getDoc(refContador);
    const agora = Date.now();
    const contador = this.#proximoContador(atual, agora);

    const lote = writeBatch(this.db);
    lote.set(refContador, contador);
    lote.set(doc(collection(this.db, "groups", idGrupo, "messages")), {
      uid: autor.uid,
      username: autor.username,
      text: texto,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(agora + Limites.horasValidadeMensagem * 3600 * 1000)
    });
    await lote.commit();
  }

  #proximoContador(atual, agora) {
    if (!atual.exists()) return { windowStart: serverTimestamp(), count: 1, lastAt: serverTimestamp() };

    const dados = atual.data();
    const ultimo = dados.lastAt ? dados.lastAt.toMillis() : 0;
    const inicio = dados.windowStart ? dados.windowStart.toMillis() : 0;

    if (agora - ultimo < Limites.intervaloMinimoSegundos * 1000) {
      throw new ErroApp("Aguarde alguns segundos antes de enviar outra mensagem.");
    }
    if (agora - inicio > Limites.janelaSegundos * 1000) {
      return { windowStart: serverTimestamp(), count: 1, lastAt: serverTimestamp() };
    }
    if (dados.count >= Limites.mensagensPorJanela) {
      throw new ErroApp("Limite de mensagens atingido. Aguarde um minuto.", { duracao: 6000 });
    }
    return { windowStart: dados.windowStart, count: dados.count + 1, lastAt: serverTimestamp() };
  }
}
