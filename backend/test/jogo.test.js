import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { criarAmbiente } from "./ajuda.js";

let amb;
let dono;
let ana;
let beto;
let caio;
let grupoId;

before(async () => {
  amb = await criarAmbiente();
  dono = await amb.criarJogador("dono");
  ana = await amb.criarJogador("ana");
  beto = await amb.criarJogador("beto");
  caio = await amb.criarJogador("caio");
});
after(async () => { await amb.encerrar(); });

const configFacil = () => ({
  versao: 1,
  ordem: ["p1", "p2", "pf"],
  enigmas: {
    p1: { modeloId: "chave-numerica", variante: 11, objeto: "bau", pistas: ["livro"], final: false },
    p2: { modeloId: "area-livre", variante: 22, objeto: "cofre", pistas: ["quadro"], final: false },
    pf: { modeloId: "selo-de-nome", variante: 33, objeto: "porta", pistas: ["bilhete"], final: true }
  },
  pistas: {
    livro: { enigma: "p1", indice: 0, requer: "" },
    quadro: { enigma: "p2", indice: 0, requer: "p1" },
    bilhete: { enigma: "pf", indice: 0, requer: "" }
  }
});

describe("grupos", () => {
  test("exige perfil completo", async () => {
    const r = await amb.api("POST", "/api/auth/register", { corpo: { name: "Sem", email: "sem@teste.com", password: "senha1234", acceptTerms: true } });
    await amb.api("POST", "/api/auth/email/verify", { corpo: { token: amb.tokenDoUltimoEmail() } });
    const g = await amb.api("GET", "/api/groups", { token: r.dados.token });
    assert.equal(g.status, 403);
    assert.equal(g.dados.erro.codigo, "PERFIL_INCOMPLETO");
  });

  test("cria grupo e respeita o intervalo de 30 segundos entre criações", async () => {
    const r = await amb.api("POST", "/api/groups", { token: dono.token, corpo: { name: "  Os   Corvos " } });
    assert.equal(r.status, 201);
    assert.equal(r.dados.name, "Os Corvos");
    assert.deepEqual(r.dados.members, [dono.uid]);
    assert.match(r.dados.inviteCode, /^[a-z0-9]{8}$/);
    grupoId = r.dados.id;

    const rapido = await amb.api("POST", "/api/groups", { token: dono.token, corpo: { name: "Outro" } });
    assert.equal(rapido.status, 429);
  });

  test("quem não é membro não lê o grupo", async () => {
    const r = await amb.api("GET", `/api/groups/${grupoId}`, { token: ana.token });
    assert.equal(r.status, 403);
    assert.equal(r.dados.erro.codigo, "NAO_MEMBRO");
    assert.equal((await amb.api("GET", "/api/groups/naoexiste", { token: ana.token })).status, 404);
  });

  test("entrada por link exige o código atual", async () => {
    const errado = await amb.api("POST", `/api/groups/${grupoId}/join`, { token: ana.token, corpo: { code: "aaaaaaaa" } });
    assert.equal(errado.status, 409);
    const grupo = (await amb.api("GET", `/api/groups/${grupoId}`, { token: dono.token })).dados;
    const ok = await amb.api("POST", `/api/groups/${grupoId}/join`, { token: ana.token, corpo: { code: grupo.inviteCode } });
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.dados.members, [dono.uid, ana.uid]);
  });

  test("renovar o código invalida o link anterior (somente o dono)", async () => {
    assert.equal((await amb.api("POST", `/api/groups/${grupoId}/invite-code`, { token: ana.token })).status, 403);
    const antigo = (await amb.api("GET", `/api/groups/${grupoId}`, { token: dono.token })).dados.inviteCode;
    const novo = (await amb.api("POST", `/api/groups/${grupoId}/invite-code`, { token: dono.token })).dados.inviteCode;
    assert.notEqual(antigo, novo);
    assert.equal((await amb.api("POST", `/api/groups/${grupoId}/join`, { token: beto.token, corpo: { code: antigo } })).status, 409);
  });
});

describe("convites", () => {
  let conviteId;

  test("o dono convida pelo username; convite pendente não é duplicado", async () => {
    const r = await amb.api("POST", `/api/groups/${grupoId}/invites`, { token: dono.token, corpo: { username: "BETO" } });
    assert.equal(r.status, 201);
    conviteId = r.dados.id;
    const repetido = await amb.api("POST", `/api/groups/${grupoId}/invites`, { token: dono.token, corpo: { username: "beto" } });
    assert.equal(repetido.status, 409);
    assert.equal(repetido.dados.erro.codigo, "CONVITE_PENDENTE");
    assert.equal((await amb.api("POST", `/api/groups/${grupoId}/invites`, { token: dono.token, corpo: { username: "ninguem" } })).status, 404);
    assert.equal((await amb.api("POST", `/api/groups/${grupoId}/invites`, { token: ana.token, corpo: { username: "caio" } })).status, 403);
  });

  test("somente o convidado responde; aceitar adiciona ao grupo", async () => {
    assert.equal((await amb.api("POST", `/api/invites/${conviteId}/response`, { token: ana.token, corpo: { accept: true } })).status, 403);
    const recebidos = await amb.api("GET", "/api/invites/received", { token: beto.token });
    assert.equal(recebidos.dados.length, 1);
    assert.equal((await amb.api("POST", `/api/invites/${conviteId}/response`, { token: beto.token, corpo: { accept: true } })).status, 204);
    assert.equal((await amb.api("POST", `/api/invites/${conviteId}/response`, { token: beto.token, corpo: { accept: true } })).status, 409);
    const grupo = await amb.api("GET", `/api/groups/${grupoId}`, { token: beto.token });
    assert.equal(grupo.dados.memberCount, 3);
  });

  test("o grupo não passa de 4 integrantes", async () => {
    await amb.api("POST", `/api/groups/${grupoId}/invites`, { token: dono.token, corpo: { username: "caio" } });
    const convite = (await amb.api("GET", "/api/invites/received", { token: caio.token })).dados[0];
    await amb.api("POST", `/api/invites/${convite.id}/response`, { token: caio.token, corpo: { accept: true } });
    const extra = await amb.criarJogador("extra");
    const cheio = await amb.api("POST", `/api/groups/${grupoId}/invites`, { token: dono.token, corpo: { username: "extra" } });
    assert.equal(cheio.status, 409);
    assert.equal(cheio.dados.erro.codigo, "GRUPO_CHEIO");
    const codigo = (await amb.api("GET", `/api/groups/${grupoId}`, { token: dono.token })).dados.inviteCode;
    assert.equal((await amb.api("POST", `/api/groups/${grupoId}/join`, { token: extra.token, corpo: { code: codigo } })).status, 409);
  });
});

describe("chat", () => {
  test("membros enviam e leem; o nome vem do servidor", async () => {
    const r = await amb.api("POST", `/api/groups/${grupoId}/messages`, { token: ana.token, corpo: { text: "  olá   equipe ", username: "falso", uid: dono.uid } });
    assert.equal(r.status, 201);
    assert.equal(r.dados.text, "olá equipe");
    assert.equal(r.dados.username, "ana");
    assert.equal(r.dados.uid, ana.uid);
    const lista = await amb.api("GET", `/api/groups/${grupoId}/messages`, { token: beto.token });
    assert.equal(lista.dados.at(-1).text, "olá equipe");
  });

  test("intervalo mínimo entre mensagens e limite de tamanho", async () => {
    const rapida = await amb.api("POST", `/api/groups/${grupoId}/messages`, { token: ana.token, corpo: { text: "de novo" } });
    assert.equal(rapida.status, 429);
    const longa = await amb.api("POST", `/api/groups/${grupoId}/messages`, { token: beto.token, corpo: { text: "x".repeat(500) } });
    assert.equal(longa.dados.text.length, 300);
    const extra = await amb.criarJogador("intrusa");
    assert.equal((await amb.api("GET", `/api/groups/${grupoId}/messages`, { token: extra.token })).status, 403);
  });
});

describe("partida", () => {
  test("somente o dono cria; configuração inválida é recusada", async () => {
    const corpo = { difficulty: "facil", seed: 42, config: configFacil() };
    assert.equal((await amb.api("POST", `/api/games/${grupoId}`, { token: ana.token, corpo })).status, 403);

    const ruins = [
      { ...corpo, difficulty: "impossivel" },
      { ...corpo, config: { ...configFacil(), ordem: ["p1", "p2"] } },
      { ...corpo, config: { ...configFacil(), extra: 1 } },
      { ...corpo, config: { ...configFacil(), pistas: { "$set": { enigma: "p1", indice: 0, requer: "" } } } }
    ];
    for (const ruim of ruins) assert.equal((await amb.api("POST", `/api/games/${grupoId}`, { token: dono.token, corpo: ruim })).status, 400);

    const ok = await amb.api("POST", `/api/games/${grupoId}`, { token: dono.token, corpo });
    assert.equal(ok.status, 201);
    assert.equal(ok.dados.status, "WAITING");
    assert.equal((await amb.api("POST", `/api/games/${grupoId}`, { token: dono.token, corpo })).status, 409);
  });

  test("até 3 jogadores entram antes do início", async () => {
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/players`, { token: ana.token })).status, 204);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/players`, { token: beto.token })).status, 204);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/players`, { token: caio.token })).status, 409);
  });

  test("pistas e enigmas antes do início são recusados", async () => {
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/clues/livro`, { token: ana.token })).status, 409);
  });

  test("o servidor define o tempo da partida ao iniciar", async () => {
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/start`, { token: ana.token })).status, 403);
    const antes = Date.now();
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/start`, { token: dono.token })).status, 204);
    const { game } = (await amb.api("GET", `/api/games/${grupoId}`, { token: ana.token })).dados;
    assert.equal(game.status, "PLAYING");
    assert.ok(Math.abs(game.expiresAt - antes - 25 * 60 * 1000) < 5000);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/start`, { token: dono.token })).status, 409);
  });

  test("dependências: pista bloqueada, enigma sem pista e final antes dos demais", async () => {
    const t = ana.token;
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/clues/quadro`, { token: t })).status, 409);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/puzzles/p1`, { token: t, corpo: { hints: 0, attempts: 0 } })).status, 409);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/clues/naoexiste`, { token: t })).status, 400);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/clues/livro`, { token: caio.token })).status, 409, "observador não registra pistas");

    assert.equal((await amb.api("POST", `/api/games/${grupoId}/clues/livro`, { token: t })).status, 204);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/clues/livro`, { token: beto.token })).status, 204, "pista repetida é aceita sem duplicar");
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/puzzles/p1`, { token: t, corpo: { hints: 9, attempts: 0 } })).status, 400);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/puzzles/p1`, { token: t, corpo: { hints: 1, attempts: 2 } })).status, 204);
    const repetido = await amb.api("POST", `/api/games/${grupoId}/puzzles/p1`, { token: beto.token, corpo: { hints: 0, attempts: 0 } });
    assert.equal(repetido.dados.erro.codigo, "ENIGMA_JA_RESOLVIDO");

    assert.equal((await amb.api("POST", `/api/games/${grupoId}/clues/bilhete`, { token: t })).status, 204);
    const finalCedo = await amb.api("POST", `/api/games/${grupoId}/puzzles/pf`, { token: t, corpo: { hints: 0, attempts: 0, score: 900 } });
    assert.equal(finalCedo.dados.erro.codigo, "ENIGMA_BLOQUEADO");

    assert.equal((await amb.api("POST", `/api/games/${grupoId}/clues/quadro`, { token: t })).status, 204);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/puzzles/p2`, { token: t, corpo: { hints: 0, attempts: 0 } })).status, 204);
  });

  test("expiração antes do tempo é recusada; o desafio final conclui a partida", async () => {
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/end`, { token: ana.token, corpo: { status: "EXPIRED" } })).status, 409);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/puzzles/pf`, { token: ana.token, corpo: { hints: 0, attempts: 0, score: 99999 } })).status, 400);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/puzzles/pf`, { token: ana.token, corpo: { hints: 0, attempts: 0, score: 950 } })).status, 204);

    const { game } = (await amb.api("GET", `/api/games/${grupoId}`, { token: dono.token })).dados;
    assert.equal(game.status, "COMPLETED");
    assert.equal(game.score, 950);
    assert.deepEqual(Object.keys(game.solved).sort(), ["p1", "p2", "pf"]);
    assert.equal(game.solved.p1.hints, 1);
  });

  test("partida encerrada pode ser apagada pelo dono para jogar de novo", async () => {
    assert.equal((await amb.api("DELETE", `/api/games/${grupoId}`, { token: ana.token })).status, 403);
    assert.equal((await amb.api("DELETE", `/api/games/${grupoId}`, { token: dono.token })).status, 204);
    assert.equal((await amb.api("GET", `/api/games/${grupoId}`, { token: dono.token })).dados.game, null);
  });

  test("tempo esgotado: qualquer membro registra a expiração; o dono pode desistir", async () => {
    await amb.api("POST", `/api/games/${grupoId}`, { token: dono.token, corpo: { difficulty: "facil", seed: 7, config: configFacil() } });
    await amb.api("POST", `/api/games/${grupoId}/start`, { token: dono.token });
    await amb.db.collection("games").updateOne({ _id: grupoId }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/clues/livro`, { token: dono.token })).status, 409);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/end`, { token: caio.token, corpo: { status: "EXPIRED" } })).status, 204);
    assert.equal((await amb.api("POST", `/api/games/${grupoId}/end`, { token: dono.token, corpo: { status: "FAILED" } })).status, 409);
  });
});

describe("salas", () => {
  test("jogadores não salvam salas; administradores salvam a sala padrão", async () => {
    const padrao = JSON.parse(await readFile(new URL("../../assets/salas/sala-gotica.json", import.meta.url), "utf8"));
    const corpo = { ...padrao, publicada: true };
    assert.equal((await amb.api("PUT", "/api/rooms/sala-gotica", { token: ana.token, corpo })).status, 403);
    assert.equal((await amb.api("GET", "/api/rooms/sala-gotica", { token: ana.token })).status, 404);

    await amb.db.collection("users").updateOne({ email: dono.email }, { $set: { role: "admin" } });
    const salvo = await amb.api("PUT", "/api/rooms/sala-gotica", { token: dono.token, corpo });
    assert.equal(salvo.status, 200);
    assert.equal(salvo.dados.hotspots.length, padrao.hotspots.length);

    const lido = await amb.api("GET", "/api/rooms/sala-gotica", { token: ana.token });
    assert.equal(lido.status, 200);
    assert.deepEqual(lido.dados.hotspots[0], padrao.hotspots[0]);

    const invalido = await amb.api("PUT", "/api/rooms/sala-gotica", { token: dono.token, corpo: { ...corpo, hotspots: [{ ...padrao.hotspots[0], interactionType: "HACK" }] } });
    assert.equal(invalido.status, 400);
  });

  test("rascunho só é visível para o administrador", async () => {
    const atual = (await amb.api("GET", "/api/rooms/sala-gotica?draft=1", { token: dono.token })).dados;
    await amb.api("PUT", "/api/rooms/sala-gotica", { token: dono.token, corpo: { ...atual, publicada: false } });
    assert.equal((await amb.api("GET", "/api/rooms/sala-gotica", { token: ana.token })).status, 404);
    assert.equal((await amb.api("GET", "/api/rooms/sala-gotica?draft=1", { token: ana.token })).status, 404);
    assert.equal((await amb.api("GET", "/api/rooms/sala-gotica?draft=1", { token: dono.token })).status, 200);
  });
});

describe("tempo real", () => {
  async function abrirEventos(token) {
    const controle = new AbortController();
    const resposta = await fetch(`${amb.base}/api/events`, { headers: { authorization: `Bearer ${token}` }, signal: controle.signal });
    const leitor = resposta.body.getReader();
    const decodificador = new TextDecoder();
    let buffer = "";
    return {
      resposta,
      async proximo(canal) {
        for (;;) {
          const fim = buffer.indexOf("\n\n");
          if (fim >= 0) {
            const bloco = buffer.slice(0, fim);
            buffer = buffer.slice(fim + 2);
            const linha = bloco.split("\n").find((l) => l.startsWith("data: "));
            if (linha && JSON.parse(linha.slice(6)).canal === canal) return true;
            continue;
          }
          const { value, done } = await leitor.read();
          if (done) return false;
          buffer += decodificador.decode(value);
        }
      },
      fechar() { controle.abort(); }
    };
  }

  test("exige autenticação", async () => {
    assert.equal((await amb.api("GET", "/api/events")).status, 401);
  });

  test("avisa os membros sobre mensagens e presença", async () => {
    const eventos = await abrirEventos(beto.token);
    assert.equal(eventos.resposta.headers.get("content-type"), "text/event-stream");
    assert.ok(await eventos.proximo("conectado"));

    const anaOnline = await abrirEventos(ana.token);
    assert.ok(await eventos.proximo(`presenca:${ana.uid}`));
    assert.equal((await amb.api("GET", `/api/users/${ana.uid}/presence`, { token: beto.token })).dados.online, true);

    await new Promise((r) => setTimeout(r, 2100));
    await amb.api("POST", `/api/groups/${grupoId}/messages`, { token: ana.token, corpo: { text: "ao vivo" } });
    assert.ok(await eventos.proximo(`chat:${grupoId}`));

    anaOnline.fechar();
    assert.ok(await eventos.proximo(`presenca:${ana.uid}`));
    eventos.fechar();
  });
});

describe("exclusão de conta", () => {
  test("exige a senha, transfere grupos e remove os dados", async () => {
    const r = await amb.api("POST", "/api/groups", { token: caio.token, corpo: { name: "Grupo do Caio" } });
    const codigo = r.dados.inviteCode;
    await amb.api("POST", `/api/groups/${r.dados.id}/join`, { token: beto.token, corpo: { code: codigo } });

    assert.equal((await amb.api("DELETE", "/api/users/me", { token: caio.token, corpo: { password: "errada" } })).status, 401);
    assert.equal((await amb.api("DELETE", "/api/users/me", { token: caio.token, corpo: { password: caio.senha } })).status, 204);

    const grupo = (await amb.api("GET", `/api/groups/${r.dados.id}`, { token: beto.token })).dados;
    assert.equal(grupo.ownerId, beto.uid);
    assert.deepEqual(grupo.members, [beto.uid]);
    assert.equal(await amb.db.collection("users").countDocuments({ email: caio.email }), 0);
    assert.equal((await amb.api("GET", "/api/users/me", { token: caio.token })).status, 401);
  });
});
