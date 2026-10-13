import crypto from "node:crypto";

export function tokenAleatorio(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

// Tokens enviados ao usuário são guardados apenas como hash
export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}
