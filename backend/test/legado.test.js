import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { criarFirebaseLegado } from "../src/services/firebaseLegado.js";
import { criarAmbiente } from "./ajuda.js";

// Contas que existem apenas no Firebase antigo
const CONTAS = {
  "velho@teste.com": { senha: "antiga123", uid: "fb-1", mfa: false, perfil: { username: "Veterano", avatarStyle: "pixel-art", avatarSeed: "v1", profileComplete: true, name: "Velho" } },
  "seguro@teste.com": { senha: "antiga123", uid: "fb-2", mfa: true, perfil: null }
};

function legadoFalso() {
  const chamadas = { redefinicao: [], senha: 0 };
  return {
    chamadas,
    async entrarComSenha(email, senha) {
      chamadas.senha++;
      const conta = CONTAS[email];
      if (!conta || conta.senha !== senha) return { situacao: "invalida" };
      return conta.mfa ? { situacao: "mfa" } : { situacao: "ok", idToken: `id-${conta.uid}` };
    },
    async conta(idToken) {
      const [email, conta] = Object.entries(CONTAS).find(([, c]) => `id-${c.uid}` === idToken);
      return { firebaseUid: conta.uid, email, emailVerified: true, name: "" };
    },
    async perfil(idToken, uid) {
      return Object.values(CONTAS).find((c) => c.uid === uid).perfil;
    },
    async enviarRedefinicao(email) { chamadas.redefinicao.push(email); }
  };
}

describe("migração de contas do Firebase", () => {
  let amb;
  let legado;
  before(async () => {
    legado = legadoFalso();
    amb = await criarAmbiente({ legado });
  });
  after(async () => { await amb.encerrar(); });

  test("primeiro login com a senha antiga cria a conta e importa o perfil", async () => {
    const r = await amb.api("POST", "/api/auth/login", { corpo: { email: "velho@teste.com", password: "antiga123" } });
    assert.equal(r.status, 200);
    assert.equal(r.dados.etapa, "concluido");
    assert.equal(r.dados.usuario.profile.username, "Veterano");
    assert.equal(r.dados.usuario.emailVerified, true);

    const salvo = await amb.db.collection("users").findOne({ email: "velho@teste.com" });
    assert.equal(salvo.firebaseUid, "fb-1");
    assert.match(salvo.passwordHash, /^\$2[aby]\$/);
  });

  test("depois da migração o Firebase não é mais consultado", async () => {
    const antes = legado.chamadas.senha;
    const r = await amb.api("POST", "/api/auth/login", { corpo: { email: "velho@teste.com", password: "antiga123" } });
    assert.equal(r.status, 200);
    assert.equal(legado.chamadas.senha, antes);
  });

  test("senha errada de conta antiga recebe a mensagem genérica", async () => {
    const r = await amb.api("POST", "/api/auth/login", { corpo: { email: "seguro@teste.com", password: "errada999" } });
    assert.equal(r.status, 401);
    assert.equal(r.dados.erro.codigo, "CREDENCIAIS_INVALIDAS");
  });

  test("conta com 2FA no Firebase não é migrada sem o segundo fator", async () => {
    const r = await amb.api("POST", "/api/auth/login", { corpo: { email: "seguro@teste.com", password: "antiga123" } });
    assert.equal(r.status, 503);
    assert.equal(r.dados.erro.codigo, "MIGRACAO_2FA_PENDENTE");
    assert.equal(r.dados.token, undefined);
    assert.equal(await amb.db.collection("users").countDocuments({ email: "seguro@teste.com" }), 0);
  });

  test("quem esqueceu a senha de uma conta ainda não migrada recebe o e-mail do Firebase", async () => {
    await amb.api("POST", "/api/auth/password/forgot", { corpo: { email: "naomigrado@teste.com" } });
    assert.deepEqual(legado.chamadas.redefinicao, ["naomigrado@teste.com"]);
  });

  test("conta nova não verificada com e-mail de conta antiga: o dono comprovado assume", async () => {
    CONTAS["disputa@teste.com"] = { senha: "verdadeira1", uid: "fb-3", mfa: false, perfil: null };
    await amb.api("POST", "/api/auth/register", { corpo: { name: "Intruso", email: "disputa@teste.com", password: "intrusa123", acceptTerms: true } });
    const sessaoIntruso = (await amb.api("POST", "/api/auth/login", { corpo: { email: "disputa@teste.com", password: "intrusa123" } })).dados.token;

    const dono = await amb.api("POST", "/api/auth/login", { corpo: { email: "disputa@teste.com", password: "verdadeira1" } });
    assert.equal(dono.status, 200);
    assert.equal(dono.dados.usuario.emailVerified, true);
    assert.equal((await amb.api("GET", "/api/users/me", { token: sessaoIntruso })).status, 401);
    assert.equal((await amb.api("POST", "/api/auth/login", { corpo: { email: "disputa@teste.com", password: "intrusa123" } })).status, 401);
  });
});

describe("cliente REST do Firebase", () => {
  function fetchFalso(respostas) {
    const pedidos = [];
    const impl = async (url, opcoes) => {
      pedidos.push({ url, corpo: opcoes.body ? JSON.parse(opcoes.body) : null });
      const [status, corpo] = respostas.shift();
      return { ok: status < 400, status, json: async () => corpo };
    };
    return { impl, pedidos };
  }

  test("identifica login que exigiria o segundo fator do Firebase", async () => {
    const { impl, pedidos } = fetchFalso([[200, { mfaPendingCredential: "pend", mfaInfo: [{ mfaEnrollmentId: "e1", totpInfo: {} }] }]]);
    const legado = criarFirebaseLegado({ chave: "k", projeto: "p" }, { fetchImpl: impl });
    assert.deepEqual(await legado.entrarComSenha("a@b.com", "x"), { situacao: "mfa" });
    assert.match(pedidos[0].url, /\/v1\/accounts:signInWithPassword\?key=k$/);
  });

  test("credenciais inválidas não viram erro interno; falhas do serviço viram 503", async () => {
    const invalida = criarFirebaseLegado({ chave: "k", projeto: "p" }, { fetchImpl: fetchFalso([[400, { error: { message: "INVALID_LOGIN_CREDENTIALS" } }]]).impl });
    assert.deepEqual(await invalida.entrarComSenha("a@b.com", "x"), { situacao: "invalida" });

    const fora = criarFirebaseLegado({ chave: "k", projeto: "p" }, { fetchImpl: fetchFalso([[500, { error: { message: "INTERNAL" } }]]).impl });
    await assert.rejects(fora.entrarComSenha("a@b.com", "x"), (e) => e.status === 503);
  });
});
