import { hashToken, tokenAleatorio } from "../utils/segredos.js";

// Tokens temporários (verificação de e-mail, redefinição de senha, etapas do login).
// O valor só existe no e-mail ou no navegador; o banco guarda o hash e o índice TTL apaga os vencidos.
export async function criarToken(ctx, { tipo, usuarioId = null, minutos, dados = {} }) {
  const token = tokenAleatorio();
  await ctx.db.collection("authTokens").insertOne({
    tokenHash: hashToken(token),
    type: tipo,
    userId: usuarioId,
    data: dados,
    attempts: 0,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + minutos * 60 * 1000)
  });
  return token;
}

function filtro(token, tipo) {
  return { tokenHash: hashToken(typeof token === "string" ? token : ""), type: tipo, expiresAt: { $gt: new Date() } };
}

export function buscarToken(ctx, token, tipo) {
  return ctx.db.collection("authTokens").findOne(filtro(token, tipo));
}

// Remoção atômica: dois pedidos simultâneos com o mesmo token não são aceitos
export function consumirToken(ctx, token, tipo) {
  return ctx.db.collection("authTokens").findOneAndDelete(filtro(token, tipo));
}

export async function registrarFalha(ctx, registro) {
  const atualizado = await ctx.db.collection("authTokens").findOneAndUpdate(
    { _id: registro._id }, { $inc: { attempts: 1 } }, { returnDocument: "after" }
  );
  return atualizado?.attempts ?? Infinity;
}

export function apagarTokens(ctx, usuarioId, tipo) {
  return ctx.db.collection("authTokens").deleteMany({ userId: usuarioId, type: tipo });
}
