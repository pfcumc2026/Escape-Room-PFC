import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { ORIGEM, criarAmbiente } from "./ajuda.js";

let amb;
before(async () => { amb = await criarAmbiente(); });
after(async () => { await amb.encerrar(); });

const cadastro = (dados = {}) => ({ name: "Ana", email: "ana@teste.com", password: "senha1234", acceptTerms: true, ...dados });

describe("servidor", () => {
  test("GET /api/health responde com o banco conectado", async () => {
    const r = await amb.api("GET", "/api/health");
    assert.equal(r.status, 200);
    assert.equal(r.dados.status, "ok");
    assert.equal(r.dados.banco, "ok");
  });

  test("rota inexistente responde 404 em JSON", async () => {
    const r = await amb.api("GET", "/api/nada");
    assert.equal(r.status, 404);
    assert.equal(r.dados.erro.codigo, "ROTA_INEXISTENTE");
  });

  test("JSON malformado responde 400 sem detalhes internos", async () => {
    const r = await fetch(`${amb.base}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).erro.codigo, "JSON_INVALIDO");
  });
});

describe("CORS", () => {
  test("aceita a origem autorizada", async () => {
    const r = await amb.api("GET", "/api/health", { cabecalhos: { origin: ORIGEM } });
    assert.equal(r.status, 200);
    assert.equal(r.cabecalhos.get("access-control-allow-origin"), ORIGEM);
  });

  test("responde ao preflight só com os métodos e cabeçalhos necessários", async () => {
    const r = await fetch(`${amb.base}/api/users/me`, {
      method: "OPTIONS",
      headers: { origin: ORIGEM, "access-control-request-method": "PATCH", "access-control-request-headers": "authorization,content-type" }
    });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get("access-control-allow-origin"), ORIGEM);
    assert.match(r.headers.get("access-control-allow-headers"), /Authorization/);
  });

  test("rejeita origem não autorizada", async () => {
    const r = await amb.api("GET", "/api/health", { cabecalhos: { origin: "https://site-malicioso.com" } });
    assert.equal(r.status, 403);
    assert.equal(r.cabecalhos.get("access-control-allow-origin"), null);
  });
});

describe("cadastro", () => {
  test("cadastro válido cria a conta, envia o e-mail e não guarda a senha original", async () => {
    const r = await amb.api("POST", "/api/auth/register", { corpo: cadastro({ email: "  Ana@Teste.COM " }) });
    assert.equal(r.status, 201);
    assert.equal(r.dados.usuario.email, "ana@teste.com");
    assert.equal(r.dados.usuario.emailVerified, false);
    assert.ok(r.dados.token);
    assert.equal(r.dados.emailEnviado, true);

    const salvo = await amb.db.collection("users").findOne({ email: "ana@teste.com" });
    assert.match(salvo.passwordHash, /^\$2[aby]\$12\$/);
    assert.ok(!JSON.stringify(salvo).includes("senha1234"));
    assert.equal(salvo.role, "player");
    assert.match(amb.emails.at(-1).texto, /verificar-email\.html\?token=/);
  });

  test("e-mail duplicado (mesmo com outra caixa) responde 409", async () => {
    const r = await amb.api("POST", "/api/auth/register", { corpo: cadastro({ email: "ANA@teste.com" }) });
    assert.equal(r.status, 409);
    assert.equal(r.dados.erro.codigo, "EMAIL_EM_USO");
  });

  test("cadastros simultâneos com o mesmo e-mail criam uma única conta", async () => {
    const corpo = cadastro({ email: "corrida@teste.com" });
    const respostas = await Promise.all([1, 2, 3].map(() => amb.api("POST", "/api/auth/register", { corpo })));
    assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 409, 409]);
    assert.equal(await amb.db.collection("users").countDocuments({ email: "corrida@teste.com" }), 1);
  });

  for (const [descricao, corpo, codigo] of [
    ["e-mail inválido", cadastro({ email: "sem-arroba" }), "EMAIL_INVALIDO"],
    ["senha curta", cadastro({ email: "x1@teste.com", password: "a1" }), "SENHA_FRACA"],
    ["senha sem números", cadastro({ email: "x2@teste.com", password: "somenteletras" }), "SENHA_FRACA"],
    ["termos não aceitos", cadastro({ email: "x3@teste.com", acceptTerms: false }), "TERMOS_NAO_ACEITOS"],
    ["e-mail como objeto (injeção)", cadastro({ email: { $gt: "" } }), "DADOS_INVALIDOS"],
    ["nome ausente", cadastro({ email: "x4@teste.com", name: "" }), "DADOS_INVALIDOS"]
  ]) {
    test(`rejeita ${descricao}`, async () => {
      const r = await amb.api("POST", "/api/auth/register", { corpo });
      assert.equal(r.status, 400);
      assert.equal(r.dados.erro.codigo, codigo);
    });
  }

  test("campos privilegiados enviados no cadastro são ignorados", async () => {
    const r = await amb.api("POST", "/api/auth/register", { corpo: cadastro({ email: "esperto@teste.com", role: "admin", emailVerified: true, _id: "x" }) });
    assert.equal(r.status, 201);
    const salvo = await amb.db.collection("users").findOne({ email: "esperto@teste.com" });
    assert.equal(salvo.role, "player");
    assert.equal(salvo.emailVerified, false);
  });
});

describe("verificação de e-mail", () => {
  test("rotas de jogo exigem e-mail verificado", async () => {
    const { dados } = await amb.api("POST", "/api/auth/login", { corpo: { email: "ana@teste.com", password: "senha1234" } });
    const r = await amb.api("GET", "/api/groups", { token: dados.token });
    assert.equal(r.status, 403);
    assert.equal(r.dados.erro.codigo, "EMAIL_NAO_VERIFICADO");
  });

  test("token de verificação funciona uma única vez", async () => {
    const { dados } = await amb.api("POST", "/api/auth/login", { corpo: { email: "ana@teste.com", password: "senha1234" } });
    await amb.api("POST", "/api/auth/email/resend", { token: dados.token });
    const token = amb.tokenDoUltimoEmail();

    const primeiro = await amb.api("POST", "/api/auth/email/verify", { corpo: { token } });
    assert.equal(primeiro.status, 200);
    const segundo = await amb.api("POST", "/api/auth/email/verify", { corpo: { token } });
    assert.equal(segundo.status, 400);
    assert.equal(segundo.dados.erro.codigo, "TOKEN_INVALIDO");

    const eu = await amb.api("GET", "/api/users/me", { token: dados.token });
    assert.equal(eu.dados.emailVerified, true);
  });
});

describe("login e rotas protegidas", () => {
  test("login correto devolve JWT e somente dados públicos", async () => {
    const r = await amb.api("POST", "/api/auth/login", { corpo: { email: "ANA@teste.com", password: "senha1234" } });
    assert.equal(r.status, 200);
    assert.equal(r.dados.etapa, "concluido");
    assert.equal(r.dados.token.split(".").length, 3);
    assert.equal(r.dados.usuario.passwordHash, undefined);
  });

  test("senha errada e e-mail inexistente recebem a mesma mensagem genérica", async () => {
    const errada = await amb.api("POST", "/api/auth/login", { corpo: { email: "ana@teste.com", password: "errada123" } });
    const inexistente = await amb.api("POST", "/api/auth/login", { corpo: { email: "ninguem@teste.com", password: "errada123" } });
    assert.equal(errada.status, 401);
    assert.equal(inexistente.status, 401);
    assert.deepEqual(errada.dados, inexistente.dados);
  });

  test("rota protegida: token ausente, inválido e válido", async () => {
    const ausente = await amb.api("GET", "/api/users/me");
    assert.equal(ausente.status, 401);
    assert.equal(ausente.dados.erro.codigo, "TOKEN_AUSENTE");

    const invalido = await amb.api("GET", "/api/users/me", { token: "abc.def.ghi" });
    assert.equal(invalido.status, 401);
    assert.equal(invalido.dados.erro.codigo, "TOKEN_INVALIDO");

    const { dados } = await amb.api("POST", "/api/auth/login", { corpo: { email: "ana@teste.com", password: "senha1234" } });
    const adulterado = dados.token.slice(0, -2) + (dados.token.endsWith("A") ? "BB" : "AA");
    assert.equal((await amb.api("GET", "/api/users/me", { token: adulterado })).status, 401);

    const valido = await amb.api("GET", "/api/users/me", { token: dados.token });
    assert.equal(valido.status, 200);
    assert.equal(valido.dados.email, "ana@teste.com");
  });
});

describe("perfil", () => {
  let token;
  before(async () => {
    token = (await amb.api("POST", "/api/auth/login", { corpo: { email: "ana@teste.com", password: "senha1234" } })).dados.token;
  });

  test("completa o perfil com username e avatar", async () => {
    const r = await amb.api("PATCH", "/api/users/me", { token, corpo: { username: "Ana_1", avatarStyle: "rings", avatarSeed: "s1" } });
    assert.equal(r.status, 200);
    assert.equal(r.dados.profile.profileComplete, true);
    assert.equal(r.dados.profile.usernameLower, "ana_1");
  });

  test("não permite alterar papel, senha ou e-mail pelo perfil", async () => {
    for (const campo of [{ role: "admin" }, { passwordHash: "x" }, { email: "outro@teste.com" }, { emailVerified: true }]) {
      const r = await amb.api("PATCH", "/api/users/me", { token, corpo: campo });
      assert.equal(r.status, 400);
      assert.equal(r.dados.erro.codigo, "CAMPOS_NAO_EDITAVEIS");
    }
    const salvo = await amb.db.collection("users").findOne({ email: "ana@teste.com" });
    assert.equal(salvo.role, "player");
  });

  test("username é único sem diferenciar maiúsculas", async () => {
    const outro = await amb.criarJogador("bruno");
    const r = await amb.api("PATCH", "/api/users/me", { token: outro.token, corpo: { username: "ANA_1" } });
    assert.equal(r.status, 409);
    assert.equal(r.dados.erro.codigo, "USERNAME_EM_USO");
    const disponivel = await amb.api("GET", "/api/users/username-available/ana_1", { token: outro.token });
    assert.equal(disponivel.dados.available, false);
  });

  test("perfil público de outro jogador não expõe dados privados", async () => {
    const eu = await amb.api("GET", "/api/users/me", { token });
    const outro = await amb.criarJogador("carla");
    const r = await amb.api("GET", `/api/users/${eu.dados.uid}`, { token: outro.token });
    assert.equal(r.status, 200);
    assert.equal(r.dados.username, "Ana_1");
    assert.equal(r.dados.email, undefined);
    assert.equal(r.dados.name, undefined);
  });
});

describe("recuperação de senha", () => {
  test("resposta é a mesma para e-mail existente e inexistente", async () => {
    const enviados = amb.emails.length;
    const existe = await amb.api("POST", "/api/auth/password/forgot", { corpo: { email: "ana@teste.com" } });
    const naoExiste = await amb.api("POST", "/api/auth/password/forgot", { corpo: { email: "fantasma@teste.com" } });
    assert.equal(existe.status, 200);
    assert.deepEqual(existe.dados, naoExiste.dados);
    assert.equal(amb.emails.length, enviados + 1);
  });

  test("redefine a senha uma única vez e derruba as sessões anteriores", async () => {
    const antiga = (await amb.api("POST", "/api/auth/login", { corpo: { email: "ana@teste.com", password: "senha1234" } })).dados.token;
    await amb.api("POST", "/api/auth/password/forgot", { corpo: { email: "ana@teste.com" } });
    const token = amb.tokenDoUltimoEmail();

    const fraca = await amb.api("POST", "/api/auth/password/reset", { corpo: { token, password: "123" } });
    assert.equal(fraca.status, 400);

    const ok = await amb.api("POST", "/api/auth/password/reset", { corpo: { token, password: "novaSenha99" } });
    assert.equal(ok.status, 200);
    const repetida = await amb.api("POST", "/api/auth/password/reset", { corpo: { token, password: "outraSenha99" } });
    assert.equal(repetida.status, 400);

    assert.equal((await amb.api("GET", "/api/users/me", { token: antiga })).status, 401);
    assert.equal((await amb.api("POST", "/api/auth/login", { corpo: { email: "ana@teste.com", password: "senha1234" } })).status, 401);
    assert.equal((await amb.api("POST", "/api/auth/login", { corpo: { email: "ana@teste.com", password: "novaSenha99" } })).status, 200);
  });
});

describe("limite de tentativas", () => {
  test("bloqueia excesso de tentativas de login", async () => {
    const restrito = await criarAmbiente({ limites: { autenticacao: 3, geral: 1000 } });
    try {
      const status = [];
      for (let i = 0; i < 4; i++) {
        status.push((await restrito.api("POST", "/api/auth/login", { corpo: { email: "a@teste.com", password: "x1234567" } })).status);
      }
      assert.deepEqual(status, [401, 401, 401, 429]);
    } finally {
      await restrito.encerrar();
    }
  });
});

describe("auditoria", () => {
  test("somente administradores consultam os logs", async () => {
    const comum = await amb.criarJogador("eva");
    assert.equal((await amb.api("GET", "/api/audit", { token: comum.token })).status, 403);

    await amb.db.collection("users").updateOne({ email: comum.email }, { $set: { role: "admin" } });
    const r = await amb.api("GET", "/api/audit", { token: comum.token });
    assert.equal(r.status, 200);
    assert.ok(r.dados.some((l) => l.action === "cadastro"));
  });
});
