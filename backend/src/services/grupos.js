import crypto from "node:crypto";
import { conflito, muitasTentativas, naoEncontrado, proibido, requisicaoInvalida } from "../utils/erros.js";
import { LIMITES, objectId, texto } from "../utils/validacao.js";
import { registrarAuditoria } from "./auditoria.js";

export const MAX_INTEGRANTES = 4;
const ALFABETO = "abcdefghijkmnpqrstuvwxyz23456789";
const INTERVALO_CRIACAO_MS = 30 * 1000;

export function novoCodigo() {
  return Array.from(crypto.randomBytes(8), (b) => ALFABETO[b % ALFABETO.length]).join("");
}

export function formatarGrupo(g) {
  return {
    id: String(g._id),
    name: g.name,
    ownerId: g.ownerId,
    members: g.members,
    memberCount: g.members.length,
    maxMembers: g.maxMembers,
    inviteCode: g.inviteCode,
    createdAt: g.createdAt.getTime()
  };
}

export async function carregarGrupo(ctx, id) {
  const _id = objectId(id);
  const grupo = _id && await ctx.db.collection("groups").findOne({ _id });
  if (!grupo) throw naoEncontrado("Este grupo não existe mais.", "GRUPO_INEXISTENTE");
  return grupo;
}

export async function grupoComoMembro(ctx, id, uid) {
  const grupo = await carregarGrupo(ctx, id);
  if (!grupo.members.includes(uid)) throw proibido("Você não faz parte deste grupo.", "NAO_MEMBRO");
  return grupo;
}

export async function grupoComoDono(ctx, id, uid) {
  const grupo = await grupoComoMembro(ctx, id, uid);
  if (grupo.ownerId !== uid) throw proibido("Somente o proprietário do grupo pode fazer isso.", "SOMENTE_DONO");
  return grupo;
}

export function avisarGrupo(ctx, grupo, canal, extras = []) {
  ctx.tempoReal.notificar([...grupo.members, ...extras], canal);
}

export async function listarGrupos(ctx, uid) {
  const grupos = await ctx.db.collection("groups").find({ members: uid }).sort({ createdAt: -1 }).toArray();
  return grupos.map(formatarGrupo);
}

export async function criarGrupo(ctx, usuario, corpo) {
  const nome = texto(corpo.name, "o nome do grupo", { max: LIMITES.grupoMax });
  if (nome.length < LIMITES.grupoMin) throw requisicaoInvalida("O nome do grupo precisa ter ao menos 3 caracteres.");

  // Reserva atômica do intervalo mínimo entre criações de grupo
  const agora = new Date();
  const liberado = await ctx.db.collection("users").updateOne(
    { _id: usuario._id, $or: [{ lastGroupAt: { $exists: false } }, { lastGroupAt: null }, { lastGroupAt: { $lt: new Date(agora - INTERVALO_CRIACAO_MS) } }] },
    { $set: { lastGroupAt: agora } }
  );
  if (!liberado.modifiedCount) throw muitasTentativas("Aguarde alguns segundos antes de criar outro grupo.", "AGUARDE");

  const uid = String(usuario._id);
  const grupo = { name: nome, ownerId: uid, members: [uid], maxMembers: MAX_INTEGRANTES, inviteCode: novoCodigo(), createdAt: agora };
  grupo._id = (await ctx.db.collection("groups").insertOne(grupo)).insertedId;
  await registrarAuditoria(ctx, usuario, "grupo_criado", `${nome} (${grupo._id})`);
  ctx.tempoReal.notificar([uid], "grupos");
  return formatarGrupo(grupo);
}

export async function renovarCodigo(ctx, usuario, id) {
  const grupo = await grupoComoDono(ctx, id, String(usuario._id));
  const codigo = novoCodigo();
  await ctx.db.collection("groups").updateOne({ _id: grupo._id }, { $set: { inviteCode: codigo } });
  await registrarAuditoria(ctx, usuario, "codigo_renovado", `grupo ${id}`);
  avisarGrupo(ctx, grupo, `grupo:${id}`);
  return codigo;
}

// Entrada atômica: só acontece se o código confere e ainda há vaga
export async function adicionarMembro(ctx, grupoId, uid, filtroExtra = {}) {
  return ctx.db.collection("groups").findOneAndUpdate(
    { _id: grupoId, members: { $ne: uid }, [`members.${MAX_INTEGRANTES - 1}`]: { $exists: false }, ...filtroExtra },
    { $push: { members: uid } },
    { returnDocument: "after" }
  );
}

export async function entrarComCodigo(ctx, usuario, id, corpo) {
  const uid = String(usuario._id);
  const grupo = await carregarGrupo(ctx, id);
  if (grupo.members.includes(uid)) return formatarGrupo(grupo);
  const codigo = typeof corpo.code === "string" ? corpo.code : "";
  if (!/^[a-z0-9]{8}$/.test(codigo)) throw requisicaoInvalida("Código de convite inválido.", "CODIGO_CONVITE_INVALIDO");

  const atualizado = await adicionarMembro(ctx, grupo._id, uid, { inviteCode: codigo });
  if (!atualizado) throw conflito("Não foi possível entrar: o grupo pode estar cheio ou o código do convite mudou.", "CONVITE_INVALIDO");
  await registrarAuditoria(ctx, usuario, "grupo_entrada", `grupo ${id} (link/QR Code)`);
  avisarGrupo(ctx, atualizado, `grupo:${id}`);
  ctx.tempoReal.notificar([uid], "grupos");
  return formatarGrupo(atualizado);
}

// O proprietário remove outro integrante; um integrante comum pode sair. O proprietário exclui o grupo em vez de sair.
export async function removerMembro(ctx, usuario, id, alvo) {
  const uid = String(usuario._id);
  const grupo = await grupoComoMembro(ctx, id, uid);
  const proprioUsuario = alvo === uid;
  if (proprioUsuario && grupo.ownerId === uid) throw conflito("O proprietário não pode sair do grupo; exclua-o ou transfira-o.", "DONO_NAO_SAI");
  if (!proprioUsuario && grupo.ownerId !== uid) throw proibido("Somente o proprietário do grupo pode remover integrantes.", "SOMENTE_DONO");
  if (!grupo.members.includes(alvo)) throw naoEncontrado("Este usuário não está no grupo.", "NAO_MEMBRO");

  await ctx.db.collection("groups").updateOne({ _id: grupo._id }, { $pull: { members: alvo } });
  await registrarAuditoria(ctx, usuario, proprioUsuario ? "grupo_saida" : "integrante_removido", proprioUsuario ? `grupo ${id}` : `grupo ${id}, usuário ${alvo}`);
  avisarGrupo(ctx, grupo, `grupo:${id}`);
  ctx.tempoReal.notificar([alvo], "grupos");
}

export async function apagarGrupo(ctx, grupo) {
  const id = String(grupo._id);
  await Promise.all([
    ctx.db.collection("messages").deleteMany({ groupId: id }),
    ctx.db.collection("invites").deleteMany({ groupId: id }),
    ctx.db.collection("games").deleteOne({ _id: id })
  ]);
  await ctx.db.collection("groups").deleteOne({ _id: grupo._id });
  avisarGrupo(ctx, grupo, `grupo:${id}`);
  avisarGrupo(ctx, grupo, "grupos");
  avisarGrupo(ctx, grupo, "convites");
}

export async function excluirGrupo(ctx, usuario, id) {
  const grupo = await grupoComoDono(ctx, id, String(usuario._id));
  await apagarGrupo(ctx, grupo);
  await registrarAuditoria(ctx, usuario, "grupo_excluido", `${grupo.name} (${id})`);
}
