// Configuração do Firebase (único ponto de configuração do projeto)

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

export const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  databaseURL: "https://SEU_PROJETO-default-rtdb.firebaseio.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

await setPersistence(auth, browserLocalPersistence);

// Regras de negócio compartilhadas (espelhadas nas Security Rules)
export const LIMITES = {
  usernameMin: 3,
  usernameMax: 20,
  senhaMin: 8,
  mensagemMax: 300,
  mensagensPorJanela: 15,
  janelaSegundos: 60,
  intervaloMinimoSegundos: 2,
  intervaloCriarGrupoSegundos: 30,
  horasValidadeMensagem: 24
};

export const AVATAR_STYLES = ["bottts", "shapes", "identicon", "thumbs", "pixel-art", "rings", "glass", "icons"];

export function avatarUrl(style, seed) {
  const s = AVATAR_STYLES.includes(style) ? style : AVATAR_STYLES[0];
  const seguro = String(seed || "placeholder").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "placeholder";
  return `https://api.dicebear.com/9.x/${s}/svg?seed=${encodeURIComponent(seguro)}`;
}
