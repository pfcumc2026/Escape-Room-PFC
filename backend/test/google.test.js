import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { criarGoogle } from "../src/services/google.js";
import { ORIGEM, codigoTotp, criarAmbiente } from "./ajuda.js";

const CONFIG = { clienteId: "cliente-teste.apps.googleusercontent.com", segredo: "segredo", retorno: "http://localhost:3000/api/auth/google/callback" };

describe("validação do id_token do Google", () => {
  let chavePrivada;
  let google;

  before(async () => {
    const par = await generateKeyPair("RS256");
    chavePrivada = par.privateKey;
    const jwk = { ...(await exportJWK(par.publicKey)), kid: "k1", alg: "RS256" };
    google = criarGoogle(CONFIG, { chaves: createLocalJWKSet({ keys: [jwk] }) });
  });

  const assinar = (dados, { audiencia = CONFIG.clienteId, emissor = "https://accounts.google.com", chave } = {}) =>
    new SignJWT(dados).setProtectedHeader({ alg: "RS256", kid: "k1" }).setIssuer(emissor).setAudience(audiencia)
      .setSubject("sub-1").setIssuedAt().setExpirationTime("5m").sign(chave || chavePrivada);

  test("aceita token assinado, com audiência e nonce corretos", async () => {
    const token = await assinar({ nonce: "n1", email: "Gil@Gmail.com", email_verified: true, name: "Gil" });
    assert.deepEqual(await google.validarIdToken(token, "n1"), { sub: "sub-1", email: "gil@gmail.com", name: "Gil" });
  });

  test("rejeita nonce diferente, outra audiência, outro emissor e e-mail não verificado", async () => {
    const casos = [
      [await assinar({ nonce: "outro", email: "a@b.com", email_verified: true }), /nonce/],
      [await assinar({ nonce: "n1", email: "a@b.com", email_verified: true }, { audiencia: "outro-cliente" }), /aud/],
      [await assinar({ nonce: "n1", email: "a@b.com", email_verified: true }, { emissor: "https://falso.com" }), /iss/],
      [await assinar({ nonce: "n1", email: "a@b.com", email_verified: false }), /verificado/]
    ];
    for (const [token, erro] of casos) await assert.rejects(google.validarIdToken(token, "n1"), erro);
  });

  test("rejeita token assinado por outra chave", async () => {
    const outra = (await generateKeyPair("RS256")).privateKey;
    const token = await assinar({ nonce: "n1", email: "a@b.com", email_verified: true }, { chave: outra });
    await assert.rejects(google.validarIdToken(token, "n1"));
  });

  test("URL de autorização usa code + PKCE (S256), state e nonce", () => {
    const url = new URL(google.urlAutorizacao({ state: "s", nonce: "n", verificador: "v".repeat(50) }));
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("code_challenge_method"), "S256");
    assert.equal(url.searchParams.get("redirect_uri"), CONFIG.retorno);
    assert.equal(url.searchParams.get("state"), "s");
    assert.equal(url.searchParams.get("nonce"), "n");
  });
});

// Dublê do Google: o "código" devolvido pelo provedor carrega a identidade em JSON
const googleFalso = {
  urlAutorizacao: ({ state, nonce }) => `https://accounts.google.com/o/oauth2/v2/auth?state=${state}&nonce=${nonce}`,
  trocarCodigo: async (codigo) => codigo,
  async validarIdToken(idToken, nonce) {
    const dados = JSON.parse(idToken);
    if (dados.nonce !== nonce) throw new Error("nonce não confere");
    return { sub: dados.sub, email: dados.email, name: dados.name || "" };
  }
};

describe("fluxo de login com Google", () => {
  let amb;
  before(async () => { amb = await criarAmbiente({ google: googleFalso }); });
  after(async () => { await amb.encerrar(); });

  async function iniciar() {
    const r = await amb.api("GET", "/api/auth/google?origem=login&proximo=dashboard.html");
    assert.equal(r.status, 302);
    const destino = new URL(r.cabecalhos.get("location"));
    const cookie = r.cabecalhos.get("set-cookie");
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    return { state: destino.searchParams.get("state"), nonce: destino.searchParams.get("nonce"), cookie: cookie.split(";")[0] };
  }

  async function retornar({ state, nonce, cookie }, identidade, { stateEnviado = state, comCookie = true } = {}) {
    const code = encodeURIComponent(JSON.stringify({ nonce, ...identidade }));
    const r = await amb.api("GET", `/api/auth/google/callback?code=${code}&state=${encodeURIComponent(stateEnviado)}`, {
      cabecalhos: comCookie ? { cookie } : {}
    });
    assert.equal(r.status, 302);
    return new URL(r.cabecalhos.get("location"));
  }

  test("cria a conta, devolve um código de uso único e entrega a sessão", async () => {
    const inicio = await iniciar();
    const destino = await retornar(inicio, { sub: "g-1", email: "gil@gmail.com", name: "Gil" });
    assert.equal(destino.origin, ORIGEM);
    assert.equal(destino.pathname, "/login.html");
    assert.equal(destino.searchParams.get("proximo"), "dashboard.html");
    assert.ok(!destino.href.includes("eyJ"), "o JWT não aparece na URL");

    const codigo = destino.searchParams.get("google");
    const sessao = await amb.api("POST", "/api/auth/google/exchange", { corpo: { code: codigo } });
    assert.equal(sessao.status, 200);
    assert.equal(sessao.dados.usuario.email, "gil@gmail.com");
    assert.equal(sessao.dados.usuario.emailVerified, true);
    assert.equal(sessao.dados.usuario.hasPassword, false);
    assert.equal((await amb.api("POST", "/api/auth/google/exchange", { corpo: { code: codigo } })).status, 401);
  });

  test("o mesmo Google entra na mesma conta, sem duplicar", async () => {
    const destino = await retornar(await iniciar(), { sub: "g-1", email: "gil@gmail.com" });
    await amb.api("POST", "/api/auth/google/exchange", { corpo: { code: destino.searchParams.get("google") } });
    assert.equal(await amb.db.collection("users").countDocuments({ email: "gil@gmail.com" }), 1);
  });

  test("recusa retorno sem o cookie de state, com state trocado ou reaproveitado", async () => {
    const inicio = await iniciar();
    assert.equal((await retornar(inicio, { sub: "g-9", email: "x@gmail.com" }, { comCookie: false })).searchParams.get("erro"), "google_estado");
    assert.equal((await retornar(inicio, { sub: "g-9", email: "x@gmail.com" }, { stateEnviado: "forjado" })).searchParams.get("erro"), "google_estado");
    assert.ok((await retornar(inicio, { sub: "g-9", email: "x@gmail.com" })).searchParams.get("google"));
    assert.equal((await retornar(inicio, { sub: "g-9", email: "x@gmail.com" })).searchParams.get("erro"), "google_expirado");
  });

  test("cancelamento no Google volta para o login com aviso", async () => {
    const r = await amb.api("GET", "/api/auth/google/callback?error=access_denied&state=x");
    assert.equal(new URL(r.cabecalhos.get("location")).searchParams.get("erro"), "google_cancelado");
  });

  test("vincula o Google a uma conta verificada com o mesmo e-mail e mantém o 2FA", async () => {
    const jogador = await amb.criarJogador("helena", { email: "helena@gmail.com" });
    const preparo = await amb.api("POST", "/api/auth/2fa/setup", { token: jogador.token, corpo: { password: jogador.senha } });
    await amb.api("POST", "/api/auth/2fa/enable", { token: jogador.token, corpo: { code: codigoTotp(preparo.dados.secret) } });

    const destino = await retornar(await iniciar(), { sub: "g-2", email: "helena@gmail.com" });
    const entrega = await amb.api("POST", "/api/auth/google/exchange", { corpo: { code: destino.searchParams.get("google") } });
    assert.equal(entrega.dados.etapa, "2fa");
    assert.equal(entrega.dados.token, undefined);

    const final = await amb.api("POST", "/api/auth/2fa/verify", { corpo: { challenge: entrega.dados.desafio, code: codigoTotp(preparo.dados.secret, 1) } });
    assert.equal(final.status, 200);
    assert.equal(final.dados.usuario.uid, jogador.uid);
    assert.equal(final.dados.usuario.googleLinked, true);
  });

  test("conta não verificada com o mesmo e-mail: o dono do Google assume e a senha antiga é descartada", async () => {
    await amb.api("POST", "/api/auth/register", { corpo: { name: "Intruso", email: "vitima@gmail.com", password: "senha1234", acceptTerms: true } });
    const destino = await retornar(await iniciar(), { sub: "g-3", email: "vitima@gmail.com" });
    const entrega = await amb.api("POST", "/api/auth/google/exchange", { corpo: { code: destino.searchParams.get("google") } });
    assert.equal(entrega.dados.etapa, "concluido");
    assert.equal((await amb.api("POST", "/api/auth/login", { corpo: { email: "vitima@gmail.com", password: "senha1234" } })).status, 401);
  });

  test("conta já vinculada a outro Google não é sequestrada", async () => {
    const destino = await retornar(await iniciar(), { sub: "g-outro", email: "gil@gmail.com" });
    assert.equal(destino.searchParams.get("erro"), "google_outra_conta");
  });

  test("sem configuração do Google, o início volta ao login com aviso", async () => {
    const semGoogle = await criarAmbiente();
    try {
      const r = await semGoogle.api("GET", "/api/auth/google");
      assert.equal(new URL(r.cabecalhos.get("location")).searchParams.get("erro"), "google_indisponivel");
    } finally {
      await semGoogle.encerrar();
    }
  });
});
