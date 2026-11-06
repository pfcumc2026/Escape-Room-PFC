import { ObjectId } from "mongodb";
import { somarUso } from "./pontuacao.js";

const ENCERRADAS = ["COMPLETED", "FAILED", "EXPIRED"];

function resumir(partida, status) {
  const { dicas, tentativas } = somarUso(partida.solved);
  const inicio = partida.startedAt ?? null;
  const fim = partida.finishedAt ?? partida.expiresAt;
  return {
    groupId: partida.groupId,
    players: partida.players,
    difficulty: partida.difficulty,
    status,
    score: status === "COMPLETED" ? partida.score ?? 0 : null,
    puzzlesTotal: partida.config.ordem.length,
    puzzlesSolved: Object.keys(partida.solved || {}).length,
    hints: dicas,
    attempts: tentativas,
    createdAt: partida.createdAt,
    startedAt: inicio,
    finishedAt: fim,
    durationMs: inicio ? fim - inicio : null
  };
}

function statusEncerrado(partida) {
  if (ENCERRADAS.includes(partida.status)) return partida.status;
  if (partida.status === "PLAYING" && partida.expiresAt <= new Date()) return "EXPIRED";
  return null;
}

// Idempotente: a chave (groupId, createdAt) identifica a partida e impede registros duplicados
export async function arquivarPartida(ctx, partida) {
  const status = partida && statusEncerrado(partida);
  if (!status) return;
  const resumo = resumir(partida, status);
  await ctx.db.collection("gameHistory").updateOne(
    { groupId: resumo.groupId, createdAt: resumo.createdAt },
    { $setOnInsert: { _id: new ObjectId(), ...resumo } },
    { upsert: true }
  );
}

export async function arquivarPartidaDoGrupo(ctx, gid) {
  await arquivarPartida(ctx, await ctx.db.collection("games").findOne({ _id: gid }));
}

export async function removerJogadorDoHistorico(ctx, uid) {
  const historico = ctx.db.collection("gameHistory");
  await historico.updateMany({ players: uid }, { $pull: { players: uid } });
  await historico.deleteMany({ players: { $size: 0 } });
}
