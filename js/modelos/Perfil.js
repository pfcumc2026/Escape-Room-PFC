// Perfil público do usuário (users/{uid})

import { Avatar } from "../nucleo/Avatar.js";

export class Perfil {
  constructor(uid, dados = {}) {
    this.uid = uid;
    this.username = dados.username || "";
    this.usernameLower = dados.usernameLower || "";
    this.avatarStyle = dados.avatarStyle || "";
    this.avatarSeed = dados.avatarSeed || "";
    this.profileComplete = !!dados.profileComplete;
    this.createdAt = dados.createdAt || null;
    this.lastGroupAt = dados.lastGroupAt || null;
  }

  static deSnapshot(snap) {
    return snap.exists() ? new Perfil(snap.id, snap.data()) : null;
  }

  get completo() {
    return this.profileComplete;
  }

  get avatar() {
    return new Avatar(this.avatarStyle, this.avatarSeed);
  }
}
