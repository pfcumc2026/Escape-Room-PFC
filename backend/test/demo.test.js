import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { criarAmbiente } from "./ajuda.js";
import { ConfigDemo } from "../../js/modelos/ConfigDemo.js";

let amb;
let admin1;
let admin2;
let comum;
let demoId;

const virarAdmin = (u) => amb.db.collection("users").updateOne({ email: u.email }, { $set: { role: "admin" } });
const get = (caminho, token) => amb.api("GET", caminho, { token });
const post = (caminho, token, corpo) => amb.api("POST", caminho, { token, corpo });

before(async () => {
  amb = await criarAmbiente();
  admin1 = await amb.criarJogador("admin1");
  admin2 = await amb.criarJogador("admin2");
  comum = await amb.criarJogador("comum");
  await virarAdmin(admin1);
  await virarAdmin(admin2);
});
after(async () => { await amb.encerrar(); });

describe("grupo DEMO", () => {
  test("administradores veem um único grupo DEMO compartilhado", async () => {
    const lista1 = (await get("/api/groups", admin1.token)).dados;
    const demo = lista1.find((g) => g.demo);
    assert.equal(demo.name, "DEMO");
    demoId = demo.id;

    const lista2 = (await get("/api/groups", admin2.token)).dados;
    assert.equal(lista2.find((g) => g.demo).id, demoId);
    assert.equal(await amb.db.collection("groups").countDocuments({ demo: true }), 1);
    assert.deepEqual((await get(`/api/groups/${demoId}`, admin1.token)).dados.members.sort(), [admin1.uid, admin2.uid].sort());
  });

  test("jogador comum não vê, não lê e não entra no DEMO", async () => {
    assert.ok(!(await get("/api/groups", comum.token)).dados.some((g) => g.demo));
    assert.equal((await get(`/api/groups/${demoId}`, comum.token)).status, 403);
    const codigo = (await get(`/api/groups/${demoId}`, admin1.token)).dados.inviteCode;
    assert.equal((await post(`/api/groups/${demoId}/join`, comum.token, { code: codigo })).status, 403);
    assert.equal((await get(`/api/games/${demoId}`, comum.token)).status, 403);
    assert.equal((await get(`/api/groups/${demoId}/messages`, comum.token)).status, 403);
  });

  test("só administradores são convidados; nome DEMO é reservado", async () => {
    assert.equal((await post(`/api/groups/${demoId}/invites`, admin1.token, { username: "comum" })).status, 404);
    assert.equal((await post("/api/groups", comum.token, { name: "demo" })).status, 400);
  });

  test("quem deixa de ser administrador perde o acesso", async () => {
    const ex = await amb.criarJogador("exadmin");
    await virarAdmin(ex);
    assert.ok((await get("/api/groups", ex.token)).dados.some((g) => g.demo));
    await amb.db.collection("users").updateOne({ email: ex.email }, { $set: { role: "user" } });
    assert.ok(!(await get("/api/groups", ex.token)).dados.some((g) => g.demo));
    assert.equal((await get(`/api/groups/${demoId}`, ex.token)).status, 403);
  });

  test("partida fixa: o servidor aceita a configuração e qualquer admin conduz", async () => {
    const corpo = { difficulty: ConfigDemo.DIFICULDADE, seed: ConfigDemo.SEMENTE, config: ConfigDemo.CONFIG };
    assert.equal((await post(`/api/games/${demoId}`, comum.token, corpo)).status, 403);
    const criada = await post(`/api/games/${demoId}`, admin1.token, corpo);
    assert.equal(criada.status, 201);
    assert.deepEqual(criada.dados.config, ConfigDemo.CONFIG);
    assert.equal((await post(`/api/games/${demoId}/players`, admin2.token)).status, 204);
    assert.equal((await post(`/api/games/${demoId}/start`, admin2.token)).status, 204);

    const t = admin2.token;
    const passo = async (caminho, corpoPasso) => assert.equal((await post(`/api/games/${demoId}/${caminho}`, t, corpoPasso)).status, 204);
    assert.equal((await post(`/api/games/${demoId}/clues/brasao_flor`, t)).status, 409, "pista presa até resolver p1");
    await passo("clues/livro");
    await passo("puzzles/p1", { hints: 0, attempts: 0 });
    await passo("clues/brasao_flor");
    await passo("puzzles/p2", { hints: 0, attempts: 0 });
    assert.equal((await post(`/api/games/${demoId}/puzzles/pf`, t, { hints: 0, attempts: 0 })).status, 409, "final exige a pista");
    await passo("clues/pergaminhos");
    await passo("puzzles/pf", { hints: 0, attempts: 0 });
    assert.equal((await get(`/api/games/${demoId}`, admin1.token)).dados.game.status, "COMPLETED");
  });
});
