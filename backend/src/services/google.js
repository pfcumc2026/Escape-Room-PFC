import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTORIZACAO = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const CHAVES = "https://www.googleapis.com/oauth2/v3/certs";
const EMISSORES = ["https://accounts.google.com", "accounts.google.com"];

export function desafioPkce(verificador) {
  return crypto.createHash("sha256").update(verificador).digest("base64url");
}

// Fluxo Authorization Code com PKCE, state e nonce; o id_token é validado pela assinatura do Google
export function criarGoogle(config, { fetchImpl = fetch, chaves = createRemoteJWKSet(new URL(CHAVES)) } = {}) {
  if (!config) return null;

  return {
    urlAutorizacao({ state, nonce, verificador }) {
      const url = new URL(AUTORIZACAO);
      url.search = new URLSearchParams({
        client_id: config.clienteId,
        redirect_uri: config.retorno,
        response_type: "code",
        scope: "openid email profile",
        state,
        nonce,
        code_challenge: desafioPkce(verificador),
        code_challenge_method: "S256",
        prompt: "select_account"
      }).toString();
      return url.href;
    },

    async trocarCodigo(codigo, verificador) {
      const resposta = await fetchImpl(TOKEN, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: codigo,
          client_id: config.clienteId,
          client_secret: config.segredo,
          redirect_uri: config.retorno,
          grant_type: "authorization_code",
          code_verifier: verificador
        })
      });
      const dados = await resposta.json().catch(() => ({}));
      if (!resposta.ok || !dados.id_token) throw new Error(`troca do código recusada: ${dados.error || resposta.status}`);
      return dados.id_token;
    },

    async validarIdToken(idToken, nonce) {
      const { payload } = await jwtVerify(idToken, chaves, { issuer: EMISSORES, audience: config.clienteId });
      if (payload.nonce !== nonce) throw new Error("nonce não confere");
      if (payload.email_verified !== true || !payload.email) throw new Error("e-mail do Google não verificado");
      return { sub: String(payload.sub), email: String(payload.email).toLowerCase(), name: String(payload.name || "") };
    }
  };
}
