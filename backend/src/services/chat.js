import { muitasTentativas, requisicaoInvalida } from "../utils/erros.js";
import { LIMITES, texto } from "../utils/validacao.js";
import { avisarGrupo, grupoComoMembro } from "./grupos.js";

const MENSAGENS_POR_JANELA = 15;
const JANELA_MS = 60 * 1000;
const INTERVALO_MINIMO_MS = 2000;
const VALIDADE_MS = 24 * 60 * 60 * 1000;
const QUANTIDADE_EXIBIDA = 60;

function formatarMensagem(m) {
  return { id: String(m._id), uid: m.uid, username: m.username, text: m.text, createdAt: m.createdAt.getTime(), expiresAt: m.expiresAt.getTime() };
}

export async function listarMensagens(ctx, usuario, grupoId) {
  await grupoComoMembro(ctx, grupoId, String(usuario._id));
  const mensagens = await ctx.db.collection("messages")
    .find({ groupId: grupoId, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .limit(QUANTIDADE_EXIBIDA)
    .toArray();
  return mensagens.reverse().map(formatarMensagem);
}

export async function enviarMensagem(ctx, usuario, grupoId, corpo) {
  const uid = String(usuario._id);
  const grupo = await grupoComoMembro(ctx, grupoId, uid);
  const conteudo = texto(corpo.text, "a mensagem", { max: LIMITES.mensagemMax });
  if (!conteudo) throw requisicaoInvalida("Escreva uma mensagem.");

  const mensagens = ctx.db.collection("messages");
  const agora = Date.now();
  const ultima = await mensagens.findOne({ groupId: grupoId, uid }, { sort: { createdAt: -1 } });
  if (ultima && agora - ultima.createdAt.getTime() < INTERVALO_MINIMO_MS) {
    throw muitasTentativas("Aguarde alguns segundos antes de enviar outra mensagem.", "AGUARDE");
  }
  const recentes = await mensagens.countDocuments({ groupId: grupoId, uid, createdAt: { $gt: new Date(agora - JANELA_MS) } });
  if (recentes >= MENSAGENS_POR_JANELA) throw muitasTentativas("Limite de mensagens atingido. Aguarde um minuto.", "LIMITE_MENSAGENS");

  const mensagem = {
    groupId: grupoId, uid, username: usuario.username, text: conteudo,
    createdAt: new Date(agora), expiresAt: new Date(agora + VALIDADE_MS)
  };
  mensagem._id = (await mensagens.insertOne(mensagem)).insertedId;
  avisarGrupo(ctx, grupo, `chat:${grupoId}`);
  return formatarMensagem(mensagem);
}
