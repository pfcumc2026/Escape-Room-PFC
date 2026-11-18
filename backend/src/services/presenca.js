// Avisa os colegas de grupo quando alguém fica online ou offline
export async function avisarPresenca(ctx, uid) {
  try {
    const grupos = await ctx.db.collection("groups").find({ members: uid }, { projection: { members: 1 } }).toArray();
    ctx.tempoReal.notificar(grupos.flatMap((g) => g.members), `presenca:${uid}`);
  } catch (e) {
    console.warn("[presença]", e.message);
  }
}
