import express from "express";
import cors from "cors";
import { criarLimites } from "./middleware/limites.js";
import { rotaNaoEncontrada, tratarErros } from "./middleware/erros.js";
import { rotasAutenticacao } from "./routes/autenticacao.js";
import { rotasUsuarios } from "./routes/usuarios.js";
import { rotasGrupos } from "./routes/grupos.js";
import { rotasConvites } from "./routes/convites.js";
import { rotasPartidas } from "./routes/partidas.js";
import { rotasSistema } from "./routes/sistema.js";
import { ehObjetoSimples } from "./utils/validacao.js";
import { avisarPresenca } from "./services/presenca.js";

// ctx reúne as dependências (banco, configuração, e-mail, Google, tempo real); nos testes elas são substituídas
export function criarApp(ctx, { limites = {} } = {}) {
  const app = express();
  const limitadores = criarLimites(limites);
  ctx.tempoReal.quandoPresencaMudar((uid) => avisarPresenca(ctx, uid));

  app.disable("x-powered-by");
  // O Render fica atrás de um proxy: o IP real do cliente chega no X-Forwarded-For
  app.set("trust proxy", 1);

  // CORS restrito às origens do front-end; não substitui a autenticação das rotas
  app.use(cors({
    origin(origem, responder) {
      if (!origem || ctx.config.origens.includes(origem)) return responder(null, true);
      responder(new Error("ORIGEM_NAO_PERMITIDA"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    maxAge: 600
  }));

  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    if (!ehObjetoSimples(req.body)) req.body = {};
    req.ctx = ctx;
    next();
  });

  app.use("/api", limitadores.geral);
  app.use("/api/auth", rotasAutenticacao(limitadores));
  app.use("/api/users", rotasUsuarios());
  app.use("/api/groups", rotasGrupos());
  app.use("/api/invites", rotasConvites());
  app.use("/api/games", rotasPartidas());
  app.use("/api", rotasSistema());

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}
