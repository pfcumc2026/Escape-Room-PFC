// Autenticação por e-mail/senha, Google e segundo fator (TOTP)

import { firebase } from "../nucleo/Firebase.js";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut,
  createUserWithEmailAndPassword, updateProfile, sendEmailVerification,
  sendPasswordResetEmail, getMultiFactorResolver, TotpMultiFactorGenerator, getAdditionalUserInfo
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { ServicoAuditoria } from "./ServicoAuditoria.js";

export class ServicoAutenticacao {
  constructor(nucleo = firebase, auditoria = new ServicoAuditoria(nucleo)) {
    this.auth = nucleo.auth;
    this.provedorGoogle = nucleo.googleProvider;
    this.auditoria = auditoria;
  }

  usuarioAtual() {
    return new Promise((resolve) => {
      const cancelar = onAuthStateChanged(this.auth, (u) => { cancelar(); resolve(u); });
    });
  }

  async entrarComSenha(email, senha) {
    const cred = await signInWithEmailAndPassword(this.auth, email, senha);
    await this.auditoria.registrar("login", "E-mail e senha");
    return cred;
  }

  async entrarComGoogle() {
    const cred = await signInWithPopup(this.auth, this.provedorGoogle);
    await this.auditoria.registrar(getAdditionalUserInfo(cred)?.isNewUser ? "cadastro" : "login", "Google");
    return cred;
  }

  async criarConta(nome, email, senha) {
    const cred = await createUserWithEmailAndPassword(this.auth, email, senha);
    await updateProfile(cred.user, { displayName: nome });
    await sendEmailVerification(cred.user);
    await this.auditoria.registrar("cadastro", "E-mail e senha");
    return cred;
  }

  enviarVerificacao(usuario) {
    return sendEmailVerification(usuario);
  }

  enviarRedefinicaoSenha(email) {
    return sendPasswordResetEmail(this.auth, email);
  }

  async sair() {
    await this.auditoria.registrar("logout");
    await signOut(this.auth);
  }

  exigeSegundoFator(excecao) {
    return excecao.code === "auth/multi-factor-auth-required";
  }

  resolvedor(excecao) {
    return getMultiFactorResolver(this.auth, excecao);
  }

  async concluirSegundoFator(resolvedor, codigo) {
    const fator = resolvedor.hints.find((h) => h.factorId === TotpMultiFactorGenerator.FACTOR_ID) || resolvedor.hints[0];
    const cred = await resolvedor.resolveSignIn(TotpMultiFactorGenerator.assertionForSignIn(fator.uid, codigo));
    await this.auditoria.registrar("login", "Verificação em duas etapas");
    return cred;
  }

  async atualizarToken(usuario) {
    const res = await usuario.getIdTokenResult();
    if (usuario.emailVerified && res.claims.email_verified !== true) await usuario.getIdToken(true);
  }
}
