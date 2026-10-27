import { conflito, naoEncontrado, proibido, requisicaoInvalida } from "../utils/erros.js";
import { objectId } from "../utils/validacao.js";
import { registrarAuditoria } from "./auditoria.js";
import { MAX_INTEGRANTES, adicionarMembro, avisarGrupo, grupoComoDono } from "./grupos.js";

const ID_CONVITE = /^[a-f0-9]{24}_[a-f0-9]{24}$/;

export function formatarConvite(c) {
  return {
    id: c._id,
    groupId: c.groupId,
    groupName: c.groupName,
    fromUid: c.fromUid,
    fromUsername: c.fromUsername,
    toUid: c.toUid,
    toUsername: c.toUsername,
    status: c.status,
    createdAt: c.createdAt.getTime()
  };
}

async function listar(ctx, filtro) {
  const convites = await ctx.db.collection("invites").find(filtro).sort({ createdAt: -1 }).limit(100).toArray();
  return convites.map(formatarConvite);
}

export const listarRecebidos = (ctx, uid) => listar(ctx, { toUid: uid, status: "pending" });
export const listarEnviados = (ctx, uid) => listar(ctx, { fromUid: uid });

export async function listarPendentesDoGrupo(ctx, usuario, grupoId) {
  const uid = String(usuario._id);
  await grupoComoDono(ctx, grupoId, uid);
  return listar(ctx, { groupId: grupoId, fromUid: uid, status: "pending" });
}

function avisarEnvolvidos(ctx, convite) {
  ctx.tempoReal.notificar([convite.fromUid, convite.toUid], "convites");
}

export async function enviarConvite(ctx, usuario, grupoId, corpo) {
  const uid = String(usuario._id);
  const grupo = await grupoComoDono(ctx, grupoId, uid);
  const alvo = typeof corpo.username === "string" ? corpo.username.trim().toLowerCase() : "";
  if (!/^[a-z0-9_]{3,20}$/.test(alvo)) throw requisicaoInvalida("Username inválido.", "USERNAME_INVALIDO");
  if (grupo.members.length >= MAX_INTEGRANTES) throw conflito("O grupo já está cheio.", "GRUPO_CHEIO");

  const convidado = await ctx.db.collection("users").findOne({ usernameLower: alvo, profileComplete: true });
  if (!convidado) throw naoEncontrado("Usuário não encontrado.", "USUARIO_INEXISTENTE");
  const uidAlvo = String(convidado._id);
  if (uidAlvo === uid) throw conflito("Você já faz parte do grupo.", "JA_MEMBRO");
  if (grupo.members.includes(uidAlvo)) throw conflito("Este usuário já está no grupo.", "JA_MEMBRO");

  const id = `${grupoId}_${uidAlvo}`;
  const convite = {
    _id: id,
    groupId: grupoId,
    groupName: grupo.name,
    fromUid: uid,
    fromUsername: usuario.username,
    toUid: uidAlvo,
    toUsername: convidado.username,
    status: "pending",
    createdAt: new Date()
  };
  // Um convite já respondido pode ser refeito; um pendente não é duplicado
  const resultado = await ctx.db.collection("invites").replaceOne({ _id: id, status: { $ne: "pending" } }, convite, { upsert: true })
    .catch((e) => (e.code === 11000 ? null : Promise.reject(e)));
  if (!resultado) throw conflito("Já existe um convite pendente para este usuário.", "CONVITE_PENDENTE");

  await registrarAuditoria(ctx, usuario, "convite_enviado", `${alvo} para o grupo ${grupo.name} (${grupoId})`);
  avisarEnvolvidos(ctx, convite);
  return formatarConvite(convite);
}

async function carregarConvite(ctx, id) {
  const convite = ID_CONVITE.test(id) && await ctx.db.collection("invites").findOne({ _id: id });
  if (!convite) throw naoEncontrado("Este convite não existe mais.", "CONVITE_INEXISTENTE");
  return convite;
}

export async function responderConvite(ctx, usuario, id, corpo) {
  const uid = String(usuario._id);
  if (typeof corpo.accept !== "boolean") throw requisicaoInvalida("Informe se o convite foi aceito.");
  const convite = await carregarConvite(ctx, id);
  if (convite.toUid !== uid) throw proibido();

  const convites = ctx.db.collection("invites");
  const status = corpo.accept ? "accepted" : "declined";
  const reservado = await convites.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status, respondedAt: new Date() } }
  );
  if (!reservado) throw conflito("Este convite já foi respondido.", "CONVITE_RESPONDIDO");

  if (corpo.accept) {
    const objectIdGrupo = objectId(convite.groupId);
    const grupo = objectIdGrupo && await adicionarMembro(ctx, objectIdGrupo, uid);
    if (!grupo) {
      await convites.updateOne({ _id: id }, { $set: { status: "pending" }, $unset: { respondedAt: "" } });
      throw conflito("O grupo está cheio ou o convite não é mais válido.", "GRUPO_CHEIO");
    }
    avisarGrupo(ctx, grupo, `grupo:${convite.groupId}`);
    avisarGrupo(ctx, grupo, "grupos");
  }
  await registrarAuditoria(ctx, usuario, corpo.accept ? "convite_aceito" : "convite_recusado", `grupo ${convite.groupName} (${convite.groupId})`);
  avisarEnvolvidos(ctx, convite);
}

export async function cancelarConvite(ctx, usuario, id) {
  const uid = String(usuario._id);
  const convite = await carregarConvite(ctx, id);
  if (convite.toUid !== uid && convite.fromUid !== uid) throw proibido();
  await ctx.db.collection("invites").deleteOne({ _id: id });
  await registrarAuditoria(ctx, usuario, "convite_cancelado", `convite ${id}`);
  avisarEnvolvidos(ctx, convite);
}
