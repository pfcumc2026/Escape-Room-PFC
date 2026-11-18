import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { criarFirebaseLegado } from "../src/services/firebaseLegado.js";
import { codigoTotp, criarAmbiente } from "./ajuda.js";

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
      return conta.mfa ? { situacao: "mfa", pendente: `pendente-${conta.uid}`, inscricao: "totp-1" } : { situacao: "ok", idToken: `id-${conta.uid}` };
    },
    async concluirSegundoFator(pendente, inscricao, codigo) {
      return codigo === "246810" && inscricao === "totp-1" ? `id-${pendente.replace("pendente-", "")}` : null;
    },
    async conta(idToken) {
      const [email, conta] = Object.entries(CONTAS).find(([, c]) => `id-${c.uid}` === idToken);
      return { firebaseUid: conta.uid, email, emailVerified: true, name: "", googleSub: null };
    },
    async perfil(idToken, uid) {
      return Object.values(CONTAS).find((c) => c.uid === uid).perfil;
    },
    async entrarComGoogle() { return { situacao: "inexistente" }; },
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

  describe("conta com 2FA no Firebase", () => {
    let desafioConfiguracao;

    test("pede o código do autenticador antigo e não entrega sessão", async () => {
      const r = await amb.api("POST", "/api/auth/login", { corpo: { email: "seguro@teste.com", password: "antiga123" } });
      assert.equal(r.dados.etapa, "2fa-legado");
      assert.equal(r.dados.token, undefined);

      const errado = await amb.api("POST", "/api/auth/2fa/legacy/verify", { corpo: { challenge: r.dados.desafio, code: "111111" } });
      assert.equal(errado.status, 401);

      const certo = await amb.api("POST", "/api/auth/2fa/legacy/verify", { corpo: { challenge: r.dados.desafio, code: "246810" } });
      assert.equal(certo.status, 200);
      assert.equal(certo.dados.etapa, "configurar-2fa");
      assert.equal(certo.dados.token, undefined);
      desafioConfiguracao = certo.dados.desafio;
    });

    test("enquanto o novo autenticador não é confirmado, a conta continua entrando pelo fluxo antigo", async () => {
      const antes = legado.chamadas.senha;
      const r = await amb.api("POST", "/api/auth/login", { corpo: { email: "seguro@teste.com", password: "antiga123" } });
      assert.equal(r.dados.etapa, "2fa-legado");
      assert.equal(legado.chamadas.senha, antes + 1);

      const salvo = await amb.db.collection("users").findOne({ email: "seguro@teste.com" });
      assert.equal(salvo.legacy.pendingTwoFactor, true);

      // A redefinição de senha não é usada para escapar do segundo fator antigo
      const enviados = amb.emails.length;
      await amb.api("POST", "/api/auth/password/forgot", { corpo: { email: "seguro@teste.com" } });
      assert.equal(amb.emails.length, enviados);
    });

    test("o novo autenticador só é ativado com um código válido; aí a sessão é liberada", async () => {
      const preparo = await amb.api("POST", "/api/auth/2fa/migration/setup", { corpo: { challenge: desafioConfiguracao } });
      assert.equal(preparo.status, 200);

      const errado = await amb.api("POST", "/api/auth/2fa/migration/enable", { corpo: { challenge: desafioConfiguracao, code: "000000" } });
      assert.equal(errado.status, 400);
      const ainda = await amb.db.collection("users").findOne({ email: "seguro@teste.com" });
      assert.equal(ainda.legacy.pendingTwoFactor, true);

      const ok = await amb.api("POST", "/api/auth/2fa/migration/enable", { corpo: { challenge: desafioConfiguracao, code: codigoTotp(preparo.dados.secret) } });
      assert.equal(ok.status, 200);
      assert.ok(ok.dados.token);
      assert.equal(ok.dados.recoveryCodes.length, 10);
      assert.equal(ok.dados.usuario.twoFactorEnabled, true);

      const migrado = await amb.db.collection("users").findOne({ email: "seguro@teste.com" });
      assert.equal(migrado.legacy.pendingTwoFactor, undefined);

      const reuso = await amb.api("POST", "/api/auth/2fa/migration/setup", { corpo: { challenge: desafioConfiguracao } });
      assert.equal(reuso.status, 401);
    });

    test("a partir daí o login usa o 2FA próprio, sem consultar o Firebase", async () => {
      const antes = legado.chamadas.senha;
      const r = await amb.api("POST", "/api/auth/login", { corpo: { email: "seguro@teste.com", password: "antiga123" } });
      assert.equal(r.dados.etapa, "2fa");
      assert.equal(legado.chamadas.senha, antes);
    });
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

describe("conta com 2FA antigo pendente e migração desligada", () => {
  test("o login é recusado em vez de dispensar o segundo fator", async () => {
    const amb = await criarAmbiente();
    try {
      await amb.api("POST", "/api/auth/register", { corpo: { name: "Pendente", email: "pendente@teste.com", password: "senha1234", acceptTerms: true } });
      await amb.db.collection("users").updateOne({ email: "pendente@teste.com" }, { $set: { emailVerified: true, legacy: { pendingTwoFactor: true } } });
      const r = await amb.api("POST", "/api/auth/login", { corpo: { email: "pendente@teste.com", password: "senha1234" } });
      assert.equal(r.status, 503);
      assert.equal(r.dados.erro.codigo, "MIGRACAO_INDISPONIVEL");
      assert.equal(r.dados.token, undefined);
    } finally {
      await amb.encerrar();
    }
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

  test("interpreta login com segundo fator e finaliza com o código TOTP", async () => {
    const { impl, pedidos } = fetchFalso([
      [200, { mfaPendingCredential: "pend", mfaInfo: [{ mfaEnrollmentId: "e1", totpInfo: {} }] }],
      [200, { idToken: "tok" }]
    ]);
    const legado = criarFirebaseLegado({ chave: "k", projeto: "p" }, { fetchImpl: impl });
    assert.deepEqual(await legado.entrarComSenha("a@b.com", "x"), { situacao: "mfa", pendente: "pend", inscricao: "e1" });
    assert.equal(await legado.concluirSegundoFator("pend", "e1", "123456"), "tok");
    assert.match(pedidos[1].url, /\/v2\/accounts\/mfaSignIn:finalize\?key=k$/);
    assert.deepEqual(pedidos[1].corpo.totpVerificationInfo, { verificationCode: "123456" });
  });

  test("credenciais inválidas não viram erro interno; falhas do serviço viram 503", async () => {
    const invalida = criarFirebaseLegado({ chave: "k", projeto: "p" }, { fetchImpl: fetchFalso([[400, { error: { message: "INVALID_LOGIN_CREDENTIALS" } }]]).impl });
    assert.deepEqual(await invalida.entrarComSenha("a@b.com", "x"), { situacao: "invalida" });

    const fora = criarFirebaseLegado({ chave: "k", projeto: "p" }, { fetchImpl: fetchFalso([[500, { error: { message: "INTERNAL" } }]]).impl });
    await assert.rejects(fora.entrarComSenha("a@b.com", "x"), (e) => e.status === 503);
  });

  test("conta Google inexistente no Firebase é apagada logo após a consulta", async () => {
    const { impl, pedidos } = fetchFalso([[200, { isNewUser: true, idToken: "novo" }], [200, {}]]);
    const legado = criarFirebaseLegado({ chave: "k", projeto: "p" }, { fetchImpl: impl });
    assert.deepEqual(await legado.entrarComGoogle("id-google"), { situacao: "inexistente" });
    assert.match(pedidos[1].url, /accounts:delete/);
    assert.deepEqual(pedidos[1].corpo, { idToken: "novo" });
  });
});
