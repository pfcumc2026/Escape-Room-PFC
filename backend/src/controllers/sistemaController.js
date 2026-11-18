export async function saude(req, res) {
  try {
    await req.ctx.db.command({ ping: 1 });
    res.json({ status: "ok", banco: "ok", agora: Date.now() });
  } catch {
    res.status(503).json({ status: "erro", banco: "indisponivel", agora: Date.now() });
  }
}

export function tempo(req, res) {
  res.json({ now: Date.now() });
}

export function eventos(req, res) {
  req.ctx.tempoReal.abrir(String(req.usuario._id), res);
}
