import { conflito, ehChaveDuplicada, requisicaoInvalida } from "../utils/erros.js";
import { ESTILOS_AVATAR, LIMITES, texto, validarUsername } from "../utils/validacao.js";
import { registrarAuditoria } from "./auditoria.js";
import { confirmarIdentidade } from "./autenticacao.js";
import { apagarGrupo, avisarGrupo } from "./grupos.js";
import { buscarPorId, dadosProprios } from "./usuarios.js";

const EDITAVEIS = ["username", "avatarStyle", "avatarSeed", "name"];

// Somente os campos do perfil são aceitos; papel, senha, e-mail e campos internos nunca vêm do cliente
export async function atualizarPerfil(ctx, usuario, corpo) {
  const desconhecidos = Object.keys(corpo).filter((k) => !EDITAVEIS.includes(k));
  if (desconhecidos.length) throw requisicaoInvalida(`Campos não editáveis: ${desconhecidos.join(", ")}.`, "CAMPOS_NAO_EDITAVEIS");

  const $set = { updatedAt: new Date() };
  if (corpo.username !== undefined) {
    $set.username = validarUsername(corpo.username);
    $set.usernameLower = $set.username.toLowerCase();
  }
  if (corpo.avatarStyle !== undefined) {
    if (!ESTILOS_AVATAR.includes(corpo.avatarStyle)) throw requisicaoInvalida("Estilo de avatar inválido.");
    $set.avatarStyle = corpo.avatarStyle;
  }
  if (corpo.avatarSeed !== undefined) {
    if (typeof corpo.avatarSeed !== "string" || !/^[a-zA-Z0-9_-]{1,32}$/.test(corpo.avatarSeed)) throw requisicaoInvalida("Avatar inválido.");
    $set.avatarSeed = corpo.avatarSeed;
  }
  if (corpo.name !== undefined) $set.name = texto(corpo.name, "o nome", { obrigatorio: false, max: LIMITES.nomeMax });

  const final = { ...usuario, ...$set };
  $set.profileComplete = !!(final.username && final.avatarStyle && final.avatarSeed);

  try {
    await ctx.db.collection("users").updateOne({ _id: usuario._id }, { $set });
  } catch (e) {
    if (ehChaveDuplicada(e, "usernameLower")) throw conflito("Este username já está em uso.", "USERNAME_EM_USO");
    throw e;
  }
  await registrarAuditoria(ctx, usuario, usuario.profileComplete ? "perfil_atualizado" : "perfil_criado", `username: ${final.username || ""}`);
  return dadosProprios(await buscarPorId(ctx, usuario._id));
}

export async function usernameDisponivel(ctx, nome) {
  const username = validarUsername(nome);
  return !await ctx.db.collection("users").countDocuments({ usernameLower: username.toLowerCase() }, { limit: 1 });
}

// Grupos em que o usuário é proprietário passam para outro integrante ou são apagados se ele era o único
export async function excluirConta(ctx, usuario, corpo, sessaoEmitidaEm) {
  await confirmarIdentidade(usuario, corpo.password, sessaoEmitidaEm);
  const uid = String(usuario._id);
  const grupos = ctx.db.collection("groups");

  for (const grupo of await grupos.find({ members: uid }).toArray()) {
    const restantes = grupo.members.filter((m) => m !== uid);
    if (!restantes.length) {
      await apagarGrupo(ctx, grupo);
      continue;
    }
    const atualizacao = { $pull: { members: uid } };
    if (grupo.ownerId === uid) atualizacao.$set = { ownerId: restantes[0] };
    await grupos.updateOne({ _id: grupo._id }, atualizacao);
    avisarGrupo(ctx, grupo, `grupo:${grupo._id}`);
  }

  const convites = await ctx.db.collection("invites").find({ $or: [{ toUid: uid }, { fromUid: uid }] }).toArray();
  await ctx.db.collection("invites").deleteMany({ $or: [{ toUid: uid }, { fromUid: uid }] });
  ctx.tempoReal.notificar(convites.flatMap((c) => [c.toUid, c.fromUid]), "convites");

  await registrarAuditoria(ctx, usuario, "conta_excluida", `username: ${usuario.username || ""}`);
  await ctx.db.collection("authTokens").deleteMany({ userId: usuario._id });
  await ctx.db.collection("users").deleteOne({ _id: usuario._id });
}
