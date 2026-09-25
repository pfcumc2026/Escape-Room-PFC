// Conta do usuário: 2FA (TOTP), senha e exclusão definitiva

import { firebase } from "../nucleo/Firebase.js";
import {
  multiFactor, TotpMultiFactorGenerator, EmailAuthProvider,
  reauthenticateWithCredential, reauthenticateWithPopup,
  sendPasswordResetEmail, deleteUser
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  doc, collection, query, where, getDocs, deleteDoc, updateDoc, writeBatch,
  arrayRemove, increment, limit
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { ServicoPresenca } from "./ServicoPresenca.js";
import { ServicoAuditoria } from "./ServicoAuditoria.js";

export class ServicoConta {
  static CANCELADO = "cancelado";

  constructor(usuario, nucleo = firebase, presenca = new ServicoPresenca(nucleo), auditoria = new ServicoAuditoria(nucleo)) {
    this.usuario = usuario;
    this.auth = nucleo.auth;
    this.db = nucleo.db;
    this.provedorGoogle = nucleo.googleProvider;
    this.presenca = presenca;
    this.auditoria = auditoria;
    this.mfa = multiFactor(usuario);
  }

  get usaSenha() {
    return this.usuario.providerData.some((p) => p.providerId === "password");
  }

  get segundoFatorAtivo() {
    return this.mfa.enrolledFactors.length > 0;
  }

  resumo(perfil) {
    return [
      ["Username", perfil.username],
      ["E-mail", this.usuario.email || "—"],
      ["Forma de login", this.usuario.providerData.map((p) => (p.providerId === "google.com" ? "Google" : "E-mail e senha")).join(", ")],
      ["Conta criada em", new Date(this.usuario.metadata.creationTime).toLocaleString("pt-BR")]
    ];
  }

  async reautenticar() {
    if (!this.usaSenha) { await reauthenticateWithPopup(this.usuario, this.provedorGoogle); return; }
    const senha = prompt("Por segurança, digite sua senha para continuar:");
    if (!senha) throw new Error(ServicoConta.CANCELADO);
    await reauthenticateWithCredential(this.usuario, EmailAuthProvider.credential(this.usuario.email, senha));
  }

  // Repete a ação depois de reautenticar quando o Firebase considera a sessão antiga
  async #comSessaoRecente(acao) {
    try {
      return await acao();
    } catch (e) {
      if (e.code !== "auth/requires-recent-login") throw e;
      await this.reautenticar();
      return acao();
    }
  }

  async gerarSegredo() {
    const sessao = await this.#comSessaoRecente(() => this.mfa.getSession());
    return TotpMultiFactorGenerator.generateSecret(sessao);
  }

  uriDoSegredo(segredo, rotulo) {
    return segredo.generateQrCodeUrl(rotulo, "Placeholder");
  }

  async ativarSegundoFator(segredo, codigo) {
    await this.mfa.enroll(TotpMultiFactorGenerator.assertionForEnrollment(segredo, codigo), "Aplicativo autenticador");
    await this.auditoria.registrar("2fa_ativado");
  }

  async desativarSegundoFator() {
    await this.#comSessaoRecente(() => this.mfa.unenroll(this.mfa.enrolledFactors[0]));
    await this.auditoria.registrar("2fa_desativado");
  }

  async enviarTrocaSenha() {
    await sendPasswordResetEmail(this.auth, this.usuario.email);
    await this.auditoria.registrar("troca_senha");
  }

  async excluir(perfil) {
    await this.#limparDados(perfil);
    await this.auditoria.registrar("conta_excluida", `username: ${perfil.username}`);
    await this.#comSessaoRecente(() => deleteUser(this.usuario));
  }

  async #limparDados(perfil) {
    const uid = this.usuario.uid;
    const grupos = await getDocs(query(collection(this.db, "groups"), where("members", "array-contains", uid)));
    for (const g of grupos.docs) {
      const dados = g.data();
      if (dados.ownerId !== uid) {
        await updateDoc(g.ref, { members: arrayRemove(uid), memberCount: increment(-1) });
        continue;
      }
      const restantes = dados.members.filter((membro) => membro !== uid);
      if (restantes.length) {
        await updateDoc(g.ref, { ownerId: restantes[0], members: arrayRemove(uid), memberCount: increment(-1) });
        continue;
      }
      const msgs = await getDocs(query(collection(this.db, "groups", g.id, "messages"), limit(300)));
      for (let i = 0; i < msgs.docs.length; i += 200) {
        const lote = writeBatch(this.db);
        msgs.docs.slice(i, i + 200).forEach((d) => lote.delete(d.ref));
        await lote.commit();
      }
      await deleteDoc(doc(this.db, "groups", g.id, "rate", uid)).catch(() => {});
      await deleteDoc(g.ref);
    }

    for (const campo of ["toUid", "fromUid"]) {
      const convites = await getDocs(query(collection(this.db, "invites"), where(campo, "==", uid)));
      if (!convites.empty) {
        const lote = writeBatch(this.db);
        convites.docs.forEach((d) => lote.delete(d.ref));
        await lote.commit();
      }
    }

    await this.presenca.remover(uid).catch(() => {});
    await deleteDoc(doc(this.db, "users", uid, "private", "profile")).catch(() => {});
    await deleteDoc(doc(this.db, "usernames", perfil.usernameLower)).catch(() => {});
    await deleteDoc(doc(this.db, "users", uid));
  }
}
