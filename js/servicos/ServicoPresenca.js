// Presença online (Realtime Database + onDisconnect)

import { firebase } from "../nucleo/Firebase.js";
import {
  ref, onValue, onDisconnect, set, remove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

export class ServicoPresenca {
  constructor(nucleo = firebase) {
    this.rtdb = nucleo.rtdb;
  }

  #status(uid) {
    return ref(this.rtdb, `status/${uid}`);
  }

  iniciar(uid) {
    const meuStatus = this.#status(uid);
    onValue(ref(this.rtdb, ".info/connected"), (snap) => {
      if (snap.val() === false) return;
      onDisconnect(meuStatus)
        .set({ state: "offline", lastChanged: serverTimestamp() })
        .then(() => set(meuStatus, { state: "online", lastChanged: serverTimestamp() }))
        .catch((e) => console.warn("[Placeholder] presença", e));
    });
  }

  observar(uid, aoMudar) {
    return onValue(this.#status(uid), (snap) => {
      aoMudar(snap.exists() && snap.val().state === "online");
    });
  }

  remover(uid) {
    return remove(this.#status(uid));
  }
}
