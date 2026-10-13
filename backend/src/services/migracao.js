import { ehChaveDuplicada } from "../utils/erros.js";
import { ESTILOS_AVATAR } from "../utils/validacao.js";
import { novoUsuario, buscarPorId } from "./usuarios.js";

function perfilImportavel(perfil) {
  if (!perfil?.profileComplete) return null;
  const { username, avatarStyle, avatarSeed } = perfil;
  if (typeof username !== "string" || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) return null;
  if (!ESTILOS_AVATAR.includes(avatarStyle) || typeof avatarSeed !== "string" || !/^[a-zA-Z0-9_-]{1,32}$/.test(avatarSeed)) return null;
  return { username, usernameLower: username.toLowerCase(), avatarStyle, avatarSeed, profileComplete: true };
}

// Cria (ou atualiza) a conta no MongoDB a partir de uma conta do Firebase já autenticada
export async function migrarConta(ctx, { idToken, senhaHash = null, existente = null }) {
  const conta = await ctx.legado.conta(idToken);
  const usuarios = ctx.db.collection("users");
  const agora = new Date();
  const legado = { migratedAt: agora };

  if (existente) {
    const $set = { firebaseUid: conta.firebaseUid, legacy: legado, updatedAt: agora };
    if (senhaHash) $set.passwordHash = senhaHash;
    if (conta.emailVerified) $set.emailVerified = true;
    // Conta local não verificada com o mesmo e-mail: o dono comprovado da conta antiga assume e as sessões anteriores caem
    const tomada = !existente.emailVerified && !existente.firebaseUid;
    await usuarios.updateOne({ _id: existente._id }, tomada ? { $set, $inc: { sessionVersion: 1 } } : { $set });
    return buscarPorId(ctx, existente._id);
  }

  const perfil = await ctx.legado.perfil(idToken, conta.firebaseUid).catch(() => null);
  const base = novoUsuario({
    email: conta.email,
    name: perfil?.name || conta.name,
    passwordHash: senhaHash,
    emailVerified: conta.emailVerified,
    extras: { firebaseUid: conta.firebaseUid, legacy: legado }
  });

  const importado = perfilImportavel(perfil);
  for (const documento of importado ? [{ ...base, ...importado }, base] : [base]) {
    try {
      const { insertedId } = await usuarios.insertOne({ ...documento });
      return { ...documento, _id: insertedId };
    } catch (e) {
      // Username já escolhido por outra pessoa no sistema novo: o usuário escolhe outro no primeiro acesso
      if (!ehChaveDuplicada(e, "usernameLower")) throw e;
    }
  }
}
