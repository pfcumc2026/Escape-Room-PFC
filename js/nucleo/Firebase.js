// Configuração do Firebase e acesso único aos seus serviços

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js";

export class Firebase {
  static CONFIG = {
    apiKey: "AIzaSyAZS2ZgO0lZ5i3_AbW9H4DotOMGMLkkwuw",
    authDomain: "pfc-2026-f8fb8.firebaseapp.com",
    databaseURL: "https://pfc-2026-f8fb8-default-rtdb.firebaseio.com",
    projectId: "pfc-2026-f8fb8",
    storageBucket: "pfc-2026-f8fb8.firebasestorage.app",
    messagingSenderId: "924831886283",
    appId: "1:924831886283:web:05f8edc6b4e14ac41ce44e"
  };

  constructor(config = Firebase.CONFIG) {
    this.config = config;
    this.app = initializeApp(config);
    this.auth = getAuth(this.app);
    this.db = getFirestore(this.app);
    this.rtdb = getDatabase(this.app);
    this.googleProvider = new GoogleAuthProvider();
    this.googleProvider.setCustomParameters({ prompt: "select_account" });
  }

  async persistirSessao() {
    await setPersistence(this.auth, browserLocalPersistence);
  }
}

export const firebase = new Firebase();
await firebase.persistirSessao();
