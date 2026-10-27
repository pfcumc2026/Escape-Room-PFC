import { objectId } from "../utils/validacao.js";

export function buscarPorId(ctx, id) {
  const _id = typeof id === "string" ? objectId(id) : id;
  return _id ? ctx.db.collection("users").findOne({ _id }) : null;
}

export function buscarPorEmail(ctx, email) {
  return ctx.db.collection("users").findOne({ email });
}

export function novoUsuario(campos) {
  const agora = new Date();
  return {
    email: campos.email,
    name: campos.name || "",
    passwordHash: campos.passwordHash || null,
    emailVerified: !!campos.emailVerified,
    role: "player",
    profileComplete: false,
    twoFactor: { enabled: false },
    sessionVersion: 0,
    createdAt: agora,
    updatedAt: agora,
    ...campos.extras
  };
}

// Dados visíveis a outros jogadores
export function perfilPublico(u) {
  return {
    uid: String(u._id),
    username: u.username || "",
    usernameLower: u.usernameLower || "",
    avatarStyle: u.avatarStyle || "",
    avatarSeed: u.avatarSeed || "",
    profileComplete: !!u.profileComplete,
    createdAt: u.createdAt?.getTime() ?? null,
    lastGroupAt: u.lastGroupAt?.getTime() ?? null
  };
}

// Dados que somente o próprio usuário recebe
export function dadosProprios(u) {
  return {
    uid: String(u._id),
    email: u.email,
    name: u.name || "",
    emailVerified: !!u.emailVerified,
    admin: u.role === "admin",
    hasPassword: !!u.passwordHash,
    googleLinked: !!u.googleSub,
    twoFactorEnabled: !!u.twoFactor?.enabled,
    recoveryCodesLeft: u.twoFactor?.recoveryCodes?.length || 0,
    createdAt: u.createdAt?.getTime() ?? null,
    profile: perfilPublico(u)
  };
}
