// Uma falha no log não interrompe a ação do usuário
export async function registrarAuditoria(ctx, usuario, acao, detalhe = "") {
  try {
    await ctx.db.collection("auditLogs").insertOne({
      uid: usuario ? String(usuario._id) : "",
      email: usuario?.email || "",
      action: acao,
      detail: String(detalhe).slice(0, 200),
      at: new Date()
    });
  } catch (e) {
    console.warn("[auditoria]", e.message);
  }
}

export async function listarAuditoria(ctx, limite = 300) {
  const registros = await ctx.db.collection("auditLogs").find().sort({ at: -1 }).limit(limite).toArray();
  return registros.map((r) => ({ uid: r.uid, email: r.email, action: r.action, detail: r.detail, at: r.at.getTime() }));
}
