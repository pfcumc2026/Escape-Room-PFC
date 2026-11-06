const SEMANAS = 8;
const DIA_MS = 24 * 60 * 60 * 1000;
const NIVEIS = ["facil", "medio", "dificil"];

function inicioDaSemana(data) {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()));
  return new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DIA_MS);
}

export async function estatisticasDoJogador(ctx, uid, agora = new Date()) {
  const [historico, atuais] = await Promise.all([
    ctx.db.collection("gameHistory").find({ players: uid }).toArray(),
    ctx.db.collection("games").find({ players: uid, status: { $in: ["WAITING", "PLAYING"] } }).toArray()
  ]);

  const emAndamento = atuais.filter((p) => p.status === "PLAYING" && p.expiresAt > agora);
  const expiradasSemRegistro = atuais.filter((p) => p.status === "PLAYING" && p.expiresAt <= agora);
  const concluidas = historico.filter((p) => p.status === "COMPLETED");
  const naoConcluidas = historico.filter((p) => p.status !== "COMPLETED");
  const encerradas = concluidas.length + naoConcluidas.length + expiradasSemRegistro.length;

  const primeira = inicioDaSemana(agora).getTime() - (SEMANAS - 1) * 7 * DIA_MS;
  const porSemana = Array.from({ length: SEMANAS }, (_, i) => ({ inicio: new Date(primeira + i * 7 * DIA_MS).toISOString().slice(0, 10), concluidas: 0 }));
  for (const p of concluidas) {
    const indice = Math.floor((inicioDaSemana(p.finishedAt).getTime() - primeira) / (7 * DIA_MS));
    if (indice >= 0 && indice < SEMANAS) porSemana[indice].concluidas++;
  }

  const porDificuldade = Object.fromEntries(NIVEIS.map((n) => [n, {
    concluidas: concluidas.filter((p) => p.difficulty === n).length,
    naoConcluidas: naoConcluidas.filter((p) => p.difficulty === n).length + expiradasSemRegistro.filter((p) => p.difficulty === n).length
  }]));

  const duracoes = concluidas.map((p) => p.durationMs).filter((d) => d != null);
  const resolvidosAtuais = atuais.reduce((t, p) => t + Object.keys(p.solved || {}).length, 0);

  return {
    concluidas: concluidas.length,
    emAndamento: emAndamento.length,
    enigmasResolvidos: historico.reduce((t, p) => t + p.puzzlesSolved, 0) + resolvidosAtuais,
    taxaConclusao: encerradas ? concluidas.length / encerradas : null,
    tempoMedioMs: duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length) : null,
    porSemana,
    porDificuldade
  };
}
