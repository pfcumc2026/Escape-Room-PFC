import crypto from "node:crypto";

export function tokenAleatorio(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

// Tokens enviados ao usuário são guardados apenas como hash
export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// AES-256-GCM: confidencialidade e integridade do segredo TOTP guardado no banco
export function cifrar(textoClaro, chave) {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv("aes-256-gcm", chave, iv);
  const dados = Buffer.concat([cifra.update(textoClaro, "utf8"), cifra.final()]);
  return [iv, cifra.getAuthTag(), dados].map((b) => b.toString("base64")).join(".");
}

export function decifrar(guardado, chave) {
  const [iv, tag, dados] = guardado.split(".").map((p) => Buffer.from(p, "base64"));
  const decifra = crypto.createDecipheriv("aes-256-gcm", chave, iv);
  decifra.setAuthTag(tag);
  return Buffer.concat([decifra.update(dados), decifra.final()]).toString("utf8");
}
