// Presença online (Realtime Database + onDisconnect)

import { rtdb } from "./firebase.js";
import {
  ref, onValue, onDisconnect, set, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

export function iniciarPresenca(uid) {
  const meuStatus = ref(rtdb, `status/${uid}`);
  onValue(ref(rtdb, ".info/connected"), (snap) => {
    if (snap.val() === false) return;
    onDisconnect(meuStatus)
      .set({ state: "offline", lastChanged: serverTimestamp() })
      .then(() => set(meuStatus, { state: "online", lastChanged: serverTimestamp() }))
      .catch((e) => console.warn("[Placeholder] presença", e));
  });
}

export function observarPresenca(uid, aoMudar) {
  return onValue(ref(rtdb, `status/${uid}`), (snap) => {
    aoMudar(snap.exists() && snap.val().state === "online");
  });
}
