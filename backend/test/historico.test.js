import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { criarAmbiente } from "./ajuda.js";
import { arquivarPartidaDoGrupo } from "../src/services/historico.js";
import { calcularPontuacao } from "../src/services/pontuacao.js";

let amb;
let admin;
let dono;
let ana;
let beto;
let intruso;

before(async () => {
  amb = await criarAmbiente();
  admin = await amb.criarJogador("admin");
  await amb.db.collection("users").updateOne({ email: admin.email }, { $set: { role: "admin" } });
  dono = await amb.criarJogador("dono");
  ana = await amb.criarJogador("ana");
  beto = await amb.criarJogador("beto");
  intruso = await amb.criarJogador("intruso");
});
after(async () => { await amb.encerrar(); });

const config = () => ({
  versao: 1,
  ordem: ["p1", "p2", "pf"],
  enigmas: {
    p1: { modeloId: "chave-numerica", variante: 1, objeto: "bau", pistas: ["livro"], final: false },
    p2: { modeloId: "area-livre", variante: 3, objeto: "cofre", pistas: ["quadro"], final: false },
    pf: { modeloId: "selo-de-nome", variante: 2, objeto: "porta", pistas: ["bilhete"], final: true }
  },
  pistas: {
    livro: { enigma: "p1", indice: 0, requer: "" },
    quadro: { enigma: "p2", indice: 0, requer: "" },
    bilhete: { enigma: "pf", indice: 0, requer: "p1" }
  }
});

const post = (caminho, token, corpo) => amb.api("POST", caminho, { token, corpo });

async function novoGrupo(lider, nome, membros = []) {
  await amb.db.collection("users").updateOne({ email: lider.email }, { $unset: { lastGroupAt: "" } });
  const g = await post("/api/groups", lider.token, { name: nome });
  assert.equal(g.status, 201);
  for (const m of membros) {
    assert.equal((await post(`/api/groups/${g.dados.id}/join`, m.token, { code: g.dados.inviteCode })).status, 200);
  }
  return g.dados.id;
}

async function prepararPartida(lider, gid, { jogadores = [] } = {}) {
  assert.equal((await post(`/api/games/${gid}`, lider.token, { difficulty: "facil", seed: 5, config: config() })).status, 201);
  for (const j of jogadores) assert.equal((await post(`/api/games/${gid}/players`, j.token)).status, 204);
  assert.equal((await post(`/api/games/${gid}/start`, lider.token)).status, 204);
}

async function resolverTudo(token, gid, { hints = 0, attempts = 0, score } = {}) {
  const passo = async (caminho, corpo) => assert.equal((await post(`/api/games/${gid}/${caminho}`, token, corpo)).status, 204);
  await passo("clues/livro");
  await passo("puzzles/p1", { hints, attempts });
  await passo("clues/quadro");
  await passo("puzzles/p2", { hints: 0, attempts: 0 });
  await passo("clues/bilhete");
  await passo("puzzles/pf", { hints: 0, attempts: 0, ...(score !== undefined ? { score } : {}) });
}

const historico = (gid) => amb.db.collection("gameHistory").find({ groupId: gid }).toArray();
const acoes = async () => (await amb.api("GET", "/api/audit?limit=1000", { token: admin.token })).dados.map((l) => l.action);
const estatisticas = async (u) => (await amb.api("GET", "/api/users/me/stats", { token: u.token })).dados;

describe("sessão", () => {
  test("logout exige sessão válida e fica registrado", async () => {
    const u = await amb.criarJogador("saida");
    assert.equal((await post("/api/auth/logout")).status, 401);
    assert.equal((await post("/api/auth/logout", u.token)).status, 204);
    assert.ok((await acoes()).includes("logout"));
  });

  test("token expirado ou adulterado é recusado", async () => {
    const expirado = jwt.sign({ ver: 0 }, amb.ctx.config.jwt.segredo, {
      issuer: "escape-py-api", audience: "escape-py-web", algorithm: "HS256", subject: dono.uid, expiresIn: -60
    });
    const r = await amb.api("GET", "/api/users/me", { token: expirado });
    assert.equal(r.status, 401);
    assert.equal(r.dados.erro.codigo, "TOKEN_INVALIDO");
    assert.equal((await amb.api("GET", "/api/users/me", { token: `${dono.token}x` })).status, 401);
    assert.equal((await amb.api("GET", "/api/users/me", { token: dono.token })).status, 200);
  });
});

describe("grupos: remoção e exclusão", () => {
  test("remover integrante, sair do grupo e regras do proprietário", async () => {
    const gid = await novoGrupo(dono, "Remocao", [ana, beto]);
    assert.equal((await amb.api("DELETE", `/api/groups/${gid}/members/${beto.uid}`, { token: ana.token })).status, 403);
    assert.equal((await amb.api("DELETE", `/api/groups/${gid}/members/${dono.uid}`, { token: dono.token })).status, 409);
    assert.equal((await amb.api("DELETE", `/api/groups/${gid}/members/${beto.uid}`, { token: dono.token })).status, 204);
    assert.equal((await amb.api("DELETE", `/api/groups/${gid}/members/${ana.uid}`, { token: ana.token })).status, 204);
    const grupo = await amb.api("GET", `/api/groups/${gid}`, { token: dono.token });
    assert.deepEqual(grupo.dados.members, [dono.uid]);
    assert.equal((await amb.api("GET", `/api/groups/${gid}`, { token: beto.token })).status, 403);
    assert.equal((await amb.api("DELETE", `/api/groups/${gid}/members/${intruso.uid}`, { token: dono.token })).status, 404);
  });

  test("somente o dono exclui o grupo; mensagens e convites também saem", async () => {
    const gid = await novoGrupo(dono, "Excluir", [ana]);
    await post(`/api/groups/${gid}/messages`, ana.token, { text: "oi" });
    await post(`/api/groups/${gid}/invites`, dono.token, { username: "beto" });
    assert.equal((await amb.api("DELETE", `/api/groups/${gid}`, { token: ana.token })).status, 403);
    assert.equal((await amb.api("DELETE", `/api/groups/${gid}`, { token: dono.token })).status, 204);
    assert.equal((await amb.api("GET", `/api/groups/${gid}`, { token: dono.token })).status, 404);
    assert.equal(await amb.db.collection("messages").countDocuments({ groupId: gid }), 0);
    assert.equal(await amb.db.collection("invites").countDocuments({ groupId: gid }), 0);
    assert.ok((await acoes()).includes("grupo_excluido"));
  });
});

describe("convites: recusa e cancelamento", () => {
  test("recusar persiste o status e não adiciona ao grupo", async () => {
    const gid = await novoGrupo(dono, "Convites");
    const c = await post(`/api/groups/${gid}/invites`, dono.token, { username: "beto" });
    assert.equal((await post(`/api/invites/${c.dados.id}/response`, intruso.token, { accept: false })).status, 403);
    assert.equal((await post(`/api/invites/${c.dados.id}/response`, beto.token, { accept: false })).status, 204);
    assert.equal((await amb.db.collection("invites").findOne({ _id: c.dados.id })).status, "declined");
    assert.equal((await amb.api("GET", "/api/invites/received", { token: beto.token })).dados.length, 0);
    assert.equal((await amb.api("GET", `/api/groups/${gid}`, { token: dono.token })).dados.memberCount, 1);
    assert.equal((await post(`/api/invites/${c.dados.id}/response`, beto.token, { accept: true })).status, 409);
  });

  test("cancelar remove o convite pendente; terceiros não cancelam", async () => {
    const gid = await novoGrupo(ana, "Cancelar");
    const c = await post(`/api/groups/${gid}/invites`, ana.token, { username: "beto" });
    assert.equal((await amb.api("GET", `/api/groups/${gid}/invites`, { token: ana.token })).dados.length, 1);
    assert.equal((await amb.api("DELETE", `/api/invites/${c.dados.id}`, { token: intruso.token })).status, 403);
    assert.equal((await amb.api("DELETE", `/api/invites/${c.dados.id}`, { token: ana.token })).status, 204);
    assert.equal((await amb.api("GET", "/api/invites/received", { token: beto.token })).dados.length, 0);
    assert.equal((await amb.api("DELETE", `/api/invites/${c.dados.id}`, { token: ana.token })).status, 404);
    assert.ok((await acoes()).includes("convite_cancelado"));
  });
});

describe("partida: transições inválidas", () => {
  test("ordem do ciclo de vida é respeitada", async () => {
    const gid = await novoGrupo(beto, "Transicoes", [intruso]);
    assert.equal((await post(`/api/games/${gid}/start`, beto.token)).status, 404);
    assert.equal((await post(`/api/games/${gid}`, beto.token, { difficulty: "facil", seed: -1, config: config() })).status, 400);
    assert.equal((await post(`/api/games/${gid}`, intruso.token, { difficulty: "facil", seed: 1, config: config() })).status, 403);
    assert.equal((await post(`/api/games/${gid}`, beto.token, { difficulty: "facil", seed: 1, config: config() })).status, 201);

    assert.equal((await post(`/api/games/${gid}/end`, beto.token, { status: "FAILED" })).status, 409, "não encerra antes de começar");
    assert.equal((await post(`/api/games/${gid}/end`, beto.token, { status: "COMPLETED" })).status, 400);
    assert.equal((await post(`/api/games/${gid}/puzzles/p1`, beto.token, { hints: 0, attempts: 0 })).status, 409);
    assert.equal((await amb.api("DELETE", `/api/games/${gid}`, { token: beto.token })).status, 204);

    await prepararPartida(beto, gid);
    assert.equal((await post(`/api/games/${gid}/players`, intruso.token)).status, 409, "ninguém entra depois do início");
    assert.equal((await amb.api("DELETE", `/api/games/${gid}`, { token: beto.token })).status, 409, "partida em andamento não é apagada");
    assert.equal((await post(`/api/games/${gid}/end`, beto.token, { status: "FAILED" })).status, 204);
    assert.equal((await post(`/api/games/${gid}/clues/livro`, beto.token)).status, 409, "partida encerrada não aceita progresso");
    assert.equal((await post(`/api/games/${gid}/end`, beto.token, { status: "FAILED" })).status, 409);
    assert.equal((await amb.api("GET", `/api/games/${gid}`, { token: ana.token })).status, 403, "estranho ao grupo não lê a partida");
  });

  test("desafio com dicas ou tentativas inválidas é recusado", async () => {
    const gid = await novoGrupo(ana, "Invalidos");
    await prepararPartida(ana, gid);
    await post(`/api/games/${gid}/clues/livro`, ana.token);
    for (const corpo of [{ hints: -1, attempts: 0 }, { hints: 0, attempts: 5000 }, { hints: "x", attempts: 0 }, {}]) {
      assert.equal((await post(`/api/games/${gid}/puzzles/p1`, ana.token, corpo)).status, 400);
    }
    assert.equal((await amb.db.collection("games").findOne({ _id: gid })).solved.p1, undefined);
  });
});

describe("pontuação calculada pelo servidor", () => {
  test("o score enviado pelo cliente é ignorado e o resultado é imutável", async () => {
    const gid = await novoGrupo(dono, "Pontos");
    await prepararPartida(dono, gid);
    await resolverTudo(dono.token, gid, { hints: 2, attempts: 3, score: 5000 });

    const jogo = await amb.db.collection("games").findOne({ _id: gid });
    const esperado = calcularPontuacao({
      dificuldade: "facil", resolvidos: 3, dicas: 2, tentativas: 3, restanteMs: jogo.expiresAt - jogo.solved.pf.at
    });
    assert.equal(jogo.status, "COMPLETED");
    assert.equal(jogo.score, esperado);
    assert.ok(jogo.score < 5000);

    const refeito = await post(`/api/games/${gid}/puzzles/pf`, dono.token, { hints: 0, attempts: 0, score: 5000 });
    assert.equal(refeito.status, 409);
    assert.equal((await amb.db.collection("games").findOne({ _id: gid })).score, esperado);
    assert.equal((await post(`/api/games/${gid}/puzzles/pf`, dono.token, { hints: 0, attempts: 0, score: 99999 })).status, 400);
  });

  test("a fórmula respeita penalidades, bônus e teto", () => {
    assert.equal(calcularPontuacao({ dificuldade: "facil", resolvidos: 3, dicas: 0, tentativas: 0, restanteMs: 0 }), 600);
    assert.equal(calcularPontuacao({ dificuldade: "facil", resolvidos: 3, dicas: 1, tentativas: 2, restanteMs: 100000 }), 600 + 15 - 40 - 20);
    assert.equal(calcularPontuacao({ dificuldade: "dificil", resolvidos: 1, dicas: 9, tentativas: 99, restanteMs: 0 }), 0);
    assert.equal(calcularPontuacao({ dificuldade: "facil", resolvidos: 99, dicas: 0, tentativas: 0, restanteMs: 0 }), 5000);
  });
});

describe("histórico de partidas", () => {
  test("partida concluída é guardada com ID próprio e sobrevive à reinicialização", async () => {
    const gid = await novoGrupo(ana, "Historico", [beto]);
    await prepararPartida(ana, gid, { jogadores: [beto] });
    await resolverTudo(beto.token, gid, { hints: 1, attempts: 2 });

    const [registro] = await historico(gid);
    assert.ok(registro);
    assert.notEqual(String(registro._id), gid);
    assert.deepEqual(registro.players.sort(), [ana.uid, beto.uid].sort());
    assert.equal(registro.status, "COMPLETED");
    assert.equal(registro.difficulty, "facil");
    assert.equal(registro.hints, 1);
    assert.equal(registro.attempts, 2);
    assert.equal(registro.puzzlesSolved, 3);
    assert.equal(registro.score, (await amb.db.collection("games").findOne({ _id: gid })).score);
    assert.ok(registro.startedAt && registro.finishedAt && registro.durationMs >= 0);

    await arquivarPartidaDoGrupo(amb.ctx, gid);
    await arquivarPartidaDoGrupo(amb.ctx, gid);
    assert.equal((await historico(gid)).length, 1, "arquivar de novo não duplica");

    assert.equal((await amb.api("DELETE", `/api/games/${gid}`, { token: ana.token })).status, 204);
    assert.equal((await historico(gid)).length, 1, "apagar a partida preserva o histórico");

    await prepararPartida(ana, gid);
    assert.equal((await post(`/api/games/${gid}/end`, ana.token, { status: "FAILED" })).status, 204);
    const todos = await historico(gid);
    assert.equal(todos.length, 2);
    assert.deepEqual(todos.map((h) => h.status).sort(), ["COMPLETED", "FAILED"]);
    assert.equal(todos.find((h) => h.status === "FAILED").score, null);
  });

  test("excluir o grupo preserva o histórico; partida em andamento não vira registro", async () => {
    const gid = await novoGrupo(dono, "Efemero");
    await prepararPartida(dono, gid);
    await resolverTudo(dono.token, gid);
    assert.equal((await amb.api("DELETE", `/api/groups/${gid}`, { token: dono.token })).status, 204);
    assert.equal((await historico(gid)).length, 1);

    const andamento = await novoGrupo(dono, "EmCurso");
    await prepararPartida(dono, andamento);
    await amb.api("DELETE", `/api/groups/${andamento}`, { token: dono.token });
    assert.equal((await historico(andamento)).length, 0);
  });

  test("tempo esgotado em grupo excluído vira partida expirada", async () => {
    const gid = await novoGrupo(dono, "Expirada");
    await prepararPartida(dono, gid);
    await amb.db.collection("games").updateOne({ _id: gid }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await amb.api("DELETE", `/api/groups/${gid}`, { token: dono.token });
    const [registro] = await historico(gid);
    assert.equal(registro.status, "EXPIRED");
  });

  test("excluir a conta remove o jogador do histórico e apaga registros sem jogadores", async () => {
    const solo = await amb.criarJogador("solo");
    const par = await amb.criarJogador("par");
    const g1 = await novoGrupo(solo, "Solo");
    await prepararPartida(solo, g1);
    await resolverTudo(solo.token, g1);
    const g2 = await novoGrupo(par, "Par", [solo]);
    await prepararPartida(par, g2, { jogadores: [solo] });
    await resolverTudo(par.token, g2);

    const r = await amb.api("DELETE", "/api/users/me", { token: solo.token, corpo: { password: solo.senha } });
    assert.equal(r.status, 204);
    assert.equal((await historico(g1)).length, 0);
    const [restante] = await historico(g2);
    assert.deepEqual(restante.players, [par.uid]);
  });

  test("índices existem", async () => {
    const chaves = async (colecao) => (await amb.db.collection(colecao).indexes()).map((i) => Object.keys(i.key).join(","));
    assert.ok((await chaves("gameHistory")).includes("players,finishedAt"));
    assert.ok((await chaves("gameHistory")).includes("groupId,createdAt"));
    assert.ok((await chaves("games")).includes("players,status"));
  });
});

describe("estatísticas do jogador", () => {
  test("exige sessão e devolve vazio sem partidas", async () => {
    assert.equal((await amb.api("GET", "/api/users/me/stats")).status, 401);
    const novo = await amb.criarJogador("novato");
    const s = await estatisticas(novo);
    assert.equal(s.concluidas, 0);
    assert.equal(s.emAndamento, 0);
    assert.equal(s.enigmasResolvidos, 0);
    assert.equal(s.taxaConclusao, null);
    assert.equal(s.tempoMedioMs, null);
    assert.equal(s.porSemana.length, 8);
    assert.ok(s.porSemana.every((w) => w.concluidas === 0));
  });

  test("cada número vem das partidas do próprio jogador", async () => {
    const a = await amb.criarJogador("estat_a");
    const b = await amb.criarJogador("estat_b");
    const fora = await amb.criarJogador("estat_fora");

    const g1 = await novoGrupo(a, "Estat1", [b]);
    await prepararPartida(a, g1, { jogadores: [b] });
    await resolverTudo(b.token, g1);

    const g2 = await novoGrupo(a, "Estat2");
    await prepararPartida(a, g2);
    await post(`/api/games/${g2}/end`, a.token, { status: "FAILED" });

    const g3 = await novoGrupo(a, "Estat3");
    await prepararPartida(a, g3);
    await post(`/api/games/${g3}/clues/livro`, a.token);
    await post(`/api/games/${g3}/puzzles/p1`, a.token, { hints: 0, attempts: 0 });

    const sa = await estatisticas(a);
    assert.equal(sa.concluidas, 1);
    assert.equal(sa.emAndamento, 1);
    assert.equal(sa.enigmasResolvidos, 3 + 1);
    assert.equal(sa.taxaConclusao, 0.5);
    assert.ok(sa.tempoMedioMs >= 0);
    assert.deepEqual(sa.porDificuldade.facil, { concluidas: 1, naoConcluidas: 1 });
    assert.equal(sa.porSemana.reduce((t, w) => t + w.concluidas, 0), 1);
    assert.equal(sa.porSemana.at(-1).concluidas, 1);

    const sb = await estatisticas(b);
    assert.equal(sb.concluidas, 1, "cada jogador conta a partida uma vez");
    assert.equal(sb.emAndamento, 0);
    assert.equal(sb.taxaConclusao, 1);

    const sf = await estatisticas(fora);
    assert.equal(sf.concluidas + sf.emAndamento + sf.enigmasResolvidos, 0, "dados de outros grupos não vazam");
  });

  test("partida com tempo esgotado e sem registro conta como não concluída", async () => {
    const u = await amb.criarJogador("estat_exp");
    const gid = await novoGrupo(u, "Exp");
    await prepararPartida(u, gid);
    await amb.db.collection("games").updateOne({ _id: gid }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    const s = await estatisticas(u);
    assert.equal(s.emAndamento, 0);
    assert.equal(s.concluidas, 0);
    assert.equal(s.taxaConclusao, 0);
    assert.deepEqual(s.porDificuldade.facil, { concluidas: 0, naoConcluidas: 1 });
  });
});

describe("auditoria e autorização administrativa", () => {
  test("ações de partida e grupo ficam registradas", async () => {
    const lista = await acoes();
    for (const a of ["partida_iniciada", "partida_concluida", "partida_desistencia", "grupo_excluido"]) {
      assert.ok(lista.includes(a), `faltou ${a}`);
    }
  });

  test("áreas administrativas recusam jogadores e visitantes", async () => {
    assert.equal((await amb.api("GET", "/api/audit")).status, 401);
    assert.equal((await amb.api("GET", "/api/audit", { token: dono.token })).status, 403);
    assert.equal((await amb.api("PUT", "/api/rooms/sala-gotica", { token: dono.token, corpo: { publicada: true } })).status, 403);
    assert.equal((await amb.api("PUT", "/api/rooms/sala-gotica", { corpo: {} })).status, 401);
  });
});
