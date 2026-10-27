import "dotenv/config";

const OBRIGATORIAS = ["MONGODB_URI", "MONGODB_DB_NAME", "JWT_SECRET", "FRONTEND_URL", "TOTP_ENCRYPTION_KEY"];

export class ErroConfiguracao extends Error {}

function lista(valor) {
  return String(valor || "").split(",").map((v) => v.trim().replace(/\/$/, "")).filter(Boolean);
}

export function lerAmbiente(env = process.env) {
  const faltando = OBRIGATORIAS.filter((nome) => !env[nome]);
  if (faltando.length) {
    throw new ErroConfiguracao(`Variáveis de ambiente ausentes: ${faltando.join(", ")}. Veja o arquivo .env.example.`);
  }
  if (env.JWT_SECRET.length < 32) {
    throw new ErroConfiguracao("JWT_SECRET precisa ter pelo menos 32 caracteres.");
  }
  const chaveTotp = Buffer.from(env.TOTP_ENCRYPTION_KEY, "base64");
  if (chaveTotp.length !== 32) {
    throw new ErroConfiguracao("TOTP_ENCRYPTION_KEY precisa ter exatamente 32 bytes codificados em base64.");
  }

  const origens = lista(env.FRONTEND_URL);
  return {
    producao: env.NODE_ENV === "production",
    porta: Number(env.PORT) || 3000,
    origens,
    frontendUrl: origens[0],
    mongo: { uri: env.MONGODB_URI, banco: env.MONGODB_DB_NAME },
    jwt: { segredo: env.JWT_SECRET, validade: env.JWT_EXPIRES_IN || "8h" },
    chaveTotp,
    email: env.BREVO_API_KEY && env.EMAIL_FROM
      ? { chave: env.BREVO_API_KEY, remetente: env.EMAIL_FROM, nome: env.EMAIL_FROM_NAME || "Escape.py" }
      : null,
    google: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI
      ? { clienteId: env.GOOGLE_CLIENT_ID, segredo: env.GOOGLE_CLIENT_SECRET, retorno: env.GOOGLE_REDIRECT_URI }
      : null,
    firebaseLegado: env.FIREBASE_API_KEY && env.FIREBASE_PROJECT_ID
      ? { chave: env.FIREBASE_API_KEY, projeto: env.FIREBASE_PROJECT_ID }
      : null
  };
}
