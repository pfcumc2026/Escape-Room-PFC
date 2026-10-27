import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { ORIGEM, codigoTotp, criarAmbiente } from "./ajuda.js";

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
    assert.equal(r.dados.usuario.twoFactor, undefined);
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

describe("verificação em duas etapas (TOTP)", () => {
  let jogador;
  let segredo;

  before(async () => { jogador = await amb.criarJogador("dani"); });

  test("ativação exige a senha e a confirmação do primeiro código", async () => {
    const semSenha = await amb.api("POST", "/api/auth/2fa/setup", { token: jogador.token, corpo: {} });
    assert.equal(semSenha.status, 401);
    assert.equal(semSenha.dados.erro.codigo, "SENHA_INCORRETA");

    const preparo = await amb.api("POST", "/api/auth/2fa/setup", { token: jogador.token, corpo: { password: jogador.senha } });
    assert.equal(preparo.status, 200);
    assert.match(preparo.dados.uri, /^otpauth:\/\/totp\//);
    segredo = preparo.dados.secret;

    const salvo = await amb.db.collection("users").findOne({ email: jogador.email });
    assert.ok(!salvo.twoFactor.pendingSecret.includes(segredo), "o segredo fica cifrado no banco");
    assert.equal(salvo.twoFactor.enabled, false);

    const errado = await amb.api("POST", "/api/auth/2fa/enable", { token: jogador.token, corpo: { code: "000000" } });
    assert.equal(errado.status, 400);

    const ativado = await amb.api("POST", "/api/auth/2fa/enable", { token: jogador.token, corpo: { code: codigoTotp(segredo) } });
    assert.equal(ativado.status, 200);
    assert.equal(ativado.dados.recoveryCodes.length, 10);
    jogador.recuperacao = ativado.dados.recoveryCodes;

    const comCodigos = await amb.db.collection("users").findOne({ email: jogador.email });
    assert.ok(!comCodigos.twoFactor.recoveryCodes.includes(jogador.recuperacao[0]), "códigos guardados como hash");
  });

  test("login com 2FA não entrega sessão antes do segundo fator", async () => {
    const r = await amb.api("POST", "/api/auth/login", { corpo: { email: jogador.email, password: jogador.senha } });
    assert.equal(r.status, 200);
    assert.equal(r.dados.etapa, "2fa");
    assert.equal(r.dados.token, undefined);
    assert.ok(r.dados.desafio);
    assert.equal((await amb.api("GET", "/api/users/me", { token: r.dados.desafio })).status, 401);
  });

  test("código válido conclui o login; o mesmo código não pode ser reutilizado", async () => {
    const primeiro = await amb.api("POST", "/api/auth/login", { corpo: { email: jogador.email, password: jogador.senha } });
    const codigo = codigoTotp(segredo, 1);
    const ok = await amb.api("POST", "/api/auth/2fa/verify", { corpo: { challenge: primeiro.dados.desafio, code: codigo } });
    assert.equal(ok.status, 200);
    assert.ok(ok.dados.token);

    const segundo = await amb.api("POST", "/api/auth/login", { corpo: { email: jogador.email, password: jogador.senha } });
    const reuso = await amb.api("POST", "/api/auth/2fa/verify", { corpo: { challenge: segundo.dados.desafio, code: codigo } });
    assert.equal(reuso.status, 401);
    assert.equal(reuso.dados.erro.codigo, "CODIGO_INVALIDO");
  });

  test("desafio é descartado após 5 códigos errados", async () => {
    const { dados } = await amb.api("POST", "/api/auth/login", { corpo: { email: jogador.email, password: jogador.senha } });
    const status = [];
    for (let i = 0; i < 6; i++) {
      status.push((await amb.api("POST", "/api/auth/2fa/verify", { corpo: { challenge: dados.desafio, code: "111111" } })).status);
    }
    assert.deepEqual(status, [401, 401, 401, 401, 429, 401]);
  });

  test("código de recuperação funciona uma única vez", async () => {
    const usar = async () => {
      const { dados } = await amb.api("POST", "/api/auth/login", { corpo: { email: jogador.email, password: jogador.senha } });
      return amb.api("POST", "/api/auth/2fa/verify", { corpo: { challenge: dados.desafio, recoveryCode: jogador.recuperacao[0].toUpperCase() } });
    };
    assert.equal((await usar()).status, 200);
    assert.equal((await usar()).status, 401);
  });

  test("novos códigos de recuperação exigem senha e código do aplicativo e invalidam os antigos", async () => {
    const { dados } = await amb.api("POST", "/api/auth/login", { corpo: { email: jogador.email, password: jogador.senha } });
    const sessao = (await amb.api("POST", "/api/auth/2fa/verify", { corpo: { challenge: dados.desafio, recoveryCode: jogador.recuperacao[1] } })).dados.token;
    assert.ok(sessao);
    assert.equal((await amb.api("GET", "/api/users/me", { token: sessao })).dados.recoveryCodesLeft, 8);
    // Os testes anteriores já usaram o código do período atual; liberar o passo permite usar um código novo agora
    await amb.db.collection("users").updateOne({ email: jogador.email }, { $set: { "twoFactor.lastUsedStep": 0 } });

    const semSenha = await amb.api("POST", "/api/auth/2fa/recovery-codes", { token: sessao, corpo: { code: codigoTotp(segredo) } });
    assert.equal(semSenha.status, 401);
    const comRecuperacao = await amb.api("POST", "/api/auth/2fa/recovery-codes", { token: sessao, corpo: { password: jogador.senha, recoveryCode: jogador.recuperacao[3] } });
    assert.equal(comRecuperacao.status, 400);

    const novos = await amb.api("POST", "/api/auth/2fa/recovery-codes", { token: sessao, corpo: { password: jogador.senha, code: codigoTotp(segredo) } });
    assert.equal(novos.status, 200);
    assert.equal(novos.dados.recoveryCodes.length, 10);
    assert.equal((await amb.api("GET", "/api/users/me", { token: sessao })).dados.recoveryCodesLeft, 10);

    const antigo = await amb.api("POST", "/api/auth/login", { corpo: { email: jogador.email, password: jogador.senha } });
    const recusado = await amb.api("POST", "/api/auth/2fa/verify", { corpo: { challenge: antigo.dados.desafio, recoveryCode: jogador.recuperacao[2] } });
    assert.equal(recusado.status, 401);
    jogador.recuperacao = novos.dados.recoveryCodes;
  });

  test("desativação exige senha e segundo fator", async () => {
    const { dados } = await amb.api("POST", "/api/auth/login", { corpo: { email: jogador.email, password: jogador.senha } });
    const sessao = (await amb.api("POST", "/api/auth/2fa/verify", { corpo: { challenge: dados.desafio, recoveryCode: jogador.recuperacao[1] } })).dados.token;

    const semCodigo = await amb.api("POST", "/api/auth/2fa/disable", { token: sessao, corpo: { password: jogador.senha, code: "123456" } });
    assert.equal(semCodigo.status, 401);
    const senhaErrada = await amb.api("POST", "/api/auth/2fa/disable", { token: sessao, corpo: { password: "errada", recoveryCode: jogador.recuperacao[2] } });
    assert.equal(senhaErrada.status, 401);

    const ok = await amb.api("POST", "/api/auth/2fa/disable", { token: sessao, corpo: { password: jogador.senha, recoveryCode: jogador.recuperacao[2] } });
    assert.equal(ok.status, 200);
    const login = await amb.api("POST", "/api/auth/login", { corpo: { email: jogador.email, password: jogador.senha } });
    assert.equal(login.dados.etapa, "concluido");
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
