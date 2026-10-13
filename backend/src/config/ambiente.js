import "dotenv/config";

const OBRIGATORIAS = ["MONGODB_URI", "MONGODB_DB_NAME", "JWT_SECRET", "FRONTEND_URL"];

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

  const origens = lista(env.FRONTEND_URL);
  return {
    producao: env.NODE_ENV === "production",
    porta: Number(env.PORT) || 3000,
    origens,
    frontendUrl: origens[0],
    mongo: { uri: env.MONGODB_URI, banco: env.MONGODB_DB_NAME },
    jwt: { segredo: env.JWT_SECRET, validade: env.JWT_EXPIRES_IN || "8h" },
    email: env.BREVO_API_KEY && env.EMAIL_FROM
      ? { chave: env.BREVO_API_KEY, remetente: env.EMAIL_FROM, nome: env.EMAIL_FROM_NAME || "Escape.py" }
      : null,
    firebaseLegado: env.FIREBASE_API_KEY && env.FIREBASE_PROJECT_ID
      ? { chave: env.FIREBASE_API_KEY, projeto: env.FIREBASE_PROJECT_ID }
      : null
  };
}
