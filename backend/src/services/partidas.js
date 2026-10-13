import { conflito, naoEncontrado, requisicaoInvalida } from "../utils/erros.js";
import { ID_CHAVE, ehObjetoSimples, inteiro } from "../utils/validacao.js";
import { avisarGrupo, grupoComoDono, grupoComoMembro } from "./grupos.js";

export const DIFICULDADES = {
  facil: { minutos: 25, enigmas: 3 },
  medio: { minutos: 45, enigmas: 4 },
  dificil: { minutos: 60, enigmas: 5 }
};
const MAX_JOGADORES = 3;
const MAX_PISTAS = 30;
// Tolerância para diferenças pequenas entre o relógio do jogador e o do servidor
const TOLERANCIA_EXPIRACAO_MS = 2000;

const ms = (data) => data?.getTime() ?? null;
const comDatas = (mapa = {}) => Object.fromEntries(Object.entries(mapa).map(([k, v]) => [k, { ...v, at: ms(v.at) }]));

function formatarPartida(p) {
  return {
    id: p._id, groupId: p.groupId, ownerId: p.ownerId, difficulty: p.difficulty, seed: p.seed, status: p.status,
    players: p.players, config: p.config,
    createdAt: ms(p.createdAt), startedAt: ms(p.startedAt), expiresAt: ms(p.expiresAt), finishedAt: ms(p.finishedAt),
    score: p.score ?? null,
    found: comDatas(p.found), solved: comDatas(p.solved)
  };
}

const chaveValida = (valor) => typeof valor === "string" && ID_CHAVE.test(valor);

// Mesmas restrições das antigas Security Rules; as chaves viram caminhos de campo, por isso o formato é rígido
export function validarConfig(config, dificuldade) {
  const invalida = (motivo) => requisicaoInvalida(`Configuração da partida inválida: ${motivo}.`, "CONFIG_INVALIDA");
  if (!ehObjetoSimples(config)) throw invalida("formato");
  if (Object.keys(config).some((k) => !["versao", "ordem", "enigmas", "pistas"].includes(k))) throw invalida("campos desconhecidos");

  const { ordem, enigmas, pistas } = config;
  const total = DIFICULDADES[dificuldade].enigmas;
  if (!Array.isArray(ordem) || ordem.length !== total || !ordem.every(chaveValida) || new Set(ordem).size !== total) throw invalida("ordem dos enigmas");
  if (!ehObjetoSimples(enigmas) || Object.keys(enigmas).length !== total || !ordem.every((k) => Object.hasOwn(enigmas, k))) throw invalida("enigmas");
  if (!ehObjetoSimples(pistas) || Object.keys(pistas).length > MAX_PISTAS || !Object.keys(pistas).every(chaveValida)) throw invalida("pistas");

  for (const chave of ordem) {
    const e = enigmas[chave];
    if (!ehObjetoSimples(e) || Object.keys(e).some((k) => !["modeloId", "variante", "objeto", "pistas", "final"].includes(k))) throw invalida(`enigma ${chave}`);
    if (!chaveValida(e.modeloId) || !Number.isInteger(e.variante) || !chaveValida(e.objeto) || typeof e.final !== "boolean") throw invalida(`enigma ${chave}`);
    if (!Array.isArray(e.pistas) || e.pistas.length < 1 || e.pistas.length > 2) throw invalida(`pistas do enigma ${chave}`);
    if (!e.pistas.every((o) => chaveValida(o) && pistas[o]?.enigma === chave)) throw invalida(`pistas do enigma ${chave}`);
  }
  for (const p of Object.values(pistas)) {
    if (!ehObjetoSimples(p) || !Object.hasOwn(enigmas, p.enigma) || !Number.isInteger(p.indice) || p.indice < 0 || p.indice > 1) throw invalida("pista");
    if (p.requer !== "" && !Object.hasOwn(enigmas, p.requer)) throw invalida("dependência de pista");
  }
  if (ordem.filter((k) => enigmas[k].final).length !== 1) throw invalida("enigma final");
}

async function carregarPartida(ctx, gid) {
  const partida = await ctx.db.collection("games").findOne({ _id: gid });
  if (!partida) throw naoEncontrado("Não há partida neste grupo.", "PARTIDA_INEXISTENTE");
  return partida;
}

async function avisar(ctx, grupo, gid) {
  avisarGrupo(ctx, grupo, `partida:${gid}`);
}

export async function obterPartida(ctx, usuario, gid) {
  await grupoComoMembro(ctx, gid, String(usuario._id));
  const partida = await ctx.db.collection("games").findOne({ _id: gid });
  return partida ? formatarPartida(partida) : null;
}

export async function criarPartida(ctx, usuario, gid, corpo) {
  const uid = String(usuario._id);
  const grupo = await grupoComoDono(ctx, gid, uid);
  if (!Object.hasOwn(DIFICULDADES, corpo.difficulty)) throw requisicaoInvalida("Escolha uma dificuldade.", "DIFICULDADE_INVALIDA");
  const semente = inteiro(corpo.seed, "semente", 0, 999999999);
  validarConfig(corpo.config, corpo.difficulty);

  const partida = {
    _id: gid, groupId: gid, ownerId: uid, difficulty: corpo.difficulty, seed: semente,
    status: "WAITING", players: [uid], config: corpo.config, createdAt: new Date(), found: {}, solved: {}
  };
  try {
    await ctx.db.collection("games").insertOne(partida);
  } catch (e) {
    if (e.code === 11000) throw conflito("Já existe uma partida neste grupo.", "PARTIDA_EXISTENTE");
    throw e;
  }
  avisar(ctx, grupo, gid);
  return formatarPartida(partida);
}

export async function entrarNaPartida(ctx, usuario, gid) {
  const uid = String(usuario._id);
  const grupo = await grupoComoMembro(ctx, gid, uid);
  const r = await ctx.db.collection("games").updateOne(
    { _id: gid, status: "WAITING", players: { $ne: uid }, [`players.${MAX_JOGADORES - 1}`]: { $exists: false } },
    { $push: { players: uid } }
  );
  if (!r.modifiedCount) {
    await carregarPartida(ctx, gid);
    throw conflito("A partida já começou ou já tem 3 jogadores.", "PARTIDA_FECHADA");
  }
  avisar(ctx, grupo, gid);
}

// O servidor define o início e o fim: o relógio do jogador não interfere no tempo da partida
export async function iniciarPartida(ctx, usuario, gid) {
  const grupo = await grupoComoDono(ctx, gid, String(usuario._id));
  const partida = await carregarPartida(ctx, gid);
  const agora = new Date();
  const fim = new Date(agora.getTime() + DIFICULDADES[partida.difficulty].minutos * 60 * 1000);
  const r = await ctx.db.collection("games").updateOne(
    { _id: gid, status: "WAITING" },
    { $set: { status: "PLAYING", startedAt: agora, expiresAt: fim } }
  );
  if (!r.modifiedCount) throw conflito("A partida já foi iniciada.", "PARTIDA_JA_INICIADA");
  avisar(ctx, grupo, gid);
}

function filtroEmAndamento(gid, uid) {
  return { _id: gid, status: "PLAYING", expiresAt: { $gt: new Date() }, players: uid };
}

export async function registrarPista(ctx, usuario, gid, objeto) {
  const uid = String(usuario._id);
  const grupo = await grupoComoMembro(ctx, gid, uid);
  const partida = await carregarPartida(ctx, gid);
  if (!chaveValida(objeto) || !Object.hasOwn(partida.config.pistas, objeto)) throw requisicaoInvalida("Este objeto não guarda pista.", "PISTA_INEXISTENTE");
  if (partida.found?.[objeto]) return;

  const requisito = partida.config.pistas[objeto].requer;
  const r = await ctx.db.collection("games").updateOne(
    { ...filtroEmAndamento(gid, uid), [`found.${objeto}`]: { $exists: false }, ...(requisito ? { [`solved.${requisito}`]: { $exists: true } } : {}) },
    { $set: { [`found.${objeto}`]: { by: uid, at: new Date() } } }
  );
  if (!r.modifiedCount) {
    const atual = await carregarPartida(ctx, gid);
    if (atual.found?.[objeto]) return;
    throw conflito("Esta pista ainda não pode ser registrada.", "PISTA_BLOQUEADA");
  }
  avisar(ctx, grupo, gid);
}

// Exige as pistas do enigma e, no desafio final, todos os demais enigmas; o final conclui a partida
export async function registrarEnigma(ctx, usuario, gid, chave, corpo) {
  const uid = String(usuario._id);
  const grupo = await grupoComoMembro(ctx, gid, uid);
  const partida = await carregarPartida(ctx, gid);
  if (!chaveValida(chave) || !Object.hasOwn(partida.config.enigmas, chave)) throw requisicaoInvalida("Enigma inexistente.", "ENIGMA_INEXISTENTE");
  const dicas = inteiro(corpo.hints, "dicas", 0, 3);
  const tentativas = inteiro(corpo.attempts, "tentativas", 0, 1000);

  const enigma = partida.config.enigmas[chave];
  const filtro = { ...filtroEmAndamento(gid, uid), [`solved.${chave}`]: { $exists: false } };
  enigma.pistas.forEach((o) => { filtro[`found.${o}`] = { $exists: true }; });
  const $set = { [`solved.${chave}`]: { by: uid, at: new Date(), hints: dicas, attempts: tentativas } };

  if (enigma.final) {
    partida.config.ordem.filter((k) => k !== chave).forEach((k) => { filtro[`solved.${k}`] = { $exists: true }; });
    Object.assign($set, { status: "COMPLETED", finishedAt: new Date(), score: inteiro(corpo.score, "pontuação", 0, 5000) });
  }

  const r = await ctx.db.collection("games").updateOne(filtro, { $set });
  if (!r.modifiedCount) {
    const atual = await carregarPartida(ctx, gid);
    if (atual.solved?.[chave]) throw conflito("Este enigma já foi resolvido.", "ENIGMA_JA_RESOLVIDO");
    throw conflito("Este enigma ainda não pode ser resolvido.", "ENIGMA_BLOQUEADO");
  }
  avisar(ctx, grupo, gid);
}

export async function encerrarPartida(ctx, usuario, gid, corpo) {
  const uid = String(usuario._id);
  let grupo;
  let filtro;
  if (corpo.status === "EXPIRED") {
    grupo = await grupoComoMembro(ctx, gid, uid);
    filtro = { _id: gid, status: "PLAYING", expiresAt: { $lte: new Date(Date.now() + TOLERANCIA_EXPIRACAO_MS) } };
  } else if (corpo.status === "FAILED") {
    grupo = await grupoComoDono(ctx, gid, uid);
    filtro = { _id: gid, status: "PLAYING" };
  } else {
    throw requisicaoInvalida("Status de encerramento inválido.");
  }
  const r = await ctx.db.collection("games").updateOne(filtro, { $set: { status: corpo.status, finishedAt: new Date() } });
  if (!r.modifiedCount) throw conflito("A partida não pode ser encerrada agora.", "ENCERRAMENTO_RECUSADO");
  avisar(ctx, grupo, gid);
}

export async function excluirPartida(ctx, usuario, gid) {
  const grupo = await grupoComoDono(ctx, gid, String(usuario._id));
  const r = await ctx.db.collection("games").deleteOne({ _id: gid, status: { $ne: "PLAYING" } });
  if (!r.deletedCount && await ctx.db.collection("games").countDocuments({ _id: gid })) {
    throw conflito("A partida está em andamento.", "PARTIDA_EM_ANDAMENTO");
  }
  avisar(ctx, grupo, gid);
}
