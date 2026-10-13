import crypto from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import { conectar, criarIndices } from "../src/config/banco.js";
import { criarApp } from "../src/app.js";
import { criarTempoReal } from "../src/services/tempoReal.js";

export const ORIGEM = "http://localhost:5500";

// Ambiente isolado: MongoDB em memória e serviços externos substituídos por dublês que registram as chamadas
export async function criarAmbiente({ legado = null, limites = { autenticacao: 1000, geral: 10000 } } = {}) {
  const mongo = await MongoMemoryServer.create();
  const conexao = await conectar({ uri: mongo.getUri(), banco: "teste" });
  await criarIndices(conexao.db);

  const emails = [];
  const ctx = {
    config: {
      producao: false,
      origens: [ORIGEM],
      frontendUrl: ORIGEM,
      jwt: { segredo: crypto.randomBytes(32).toString("hex"), validade: "1h" }
    },
    db: conexao.db,
    email: { configurado: true, async enviar(m) { emails.push(m); } },
    legado,
    tempoReal: criarTempoReal()
  };

  const servidor = await new Promise((resolve) => {
    const s = criarApp(ctx, { limites }).listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${servidor.address().port}`;

  async function api(metodo, caminho, { corpo, token, cabecalhos = {} } = {}) {
    const resposta = await fetch(`${base}${caminho}`, {
      method: metodo,
      redirect: "manual",
      headers: {
        ...(corpo !== undefined ? { "content-type": "application/json" } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...cabecalhos
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined
    });
    const texto = await resposta.text();
    let dados = null;
    try { dados = texto ? JSON.parse(texto) : null; } catch { dados = texto; }
    return { status: resposta.status, dados, cabecalhos: resposta.headers };
  }

  function tokenDoUltimoEmail() {
    const ultimo = emails.at(-1);
    return decodeURIComponent(/token=([^\s&"]+)/.exec(ultimo.texto)[1]);
  }

  // Conta pronta para jogar: cadastrada, com e-mail verificado e perfil completo
  async function criarJogador(username, { email = `${username}@teste.com`, senha = "senha1234" } = {}) {
    const cadastro = await api("POST", "/api/auth/register", { corpo: { name: username, email, password: senha, acceptTerms: true } });
    await api("POST", "/api/auth/email/verify", { corpo: { token: tokenDoUltimoEmail() } });
    const { dados } = await api("POST", "/api/auth/login", { corpo: { email, password: senha } });
    await api("PATCH", "/api/users/me", { token: dados.token, corpo: { username, avatarStyle: "bottts", avatarSeed: "abc" } });
    return { token: dados.token, uid: cadastro.dados.usuario.uid, email, senha };
  }

  async function encerrar() {
    ctx.tempoReal.encerrar();
    servidor.closeAllConnections?.();
    await new Promise((resolve) => servidor.close(resolve));
    await conexao.cliente.close();
    await mongo.stop();
  }

  return { ctx, db: conexao.db, api, base, emails, tokenDoUltimoEmail, criarJogador, encerrar };
}
