import jwt from "jsonwebtoken";
import { dadosProprios } from "./usuarios.js";

const OPCOES = { issuer: "escape-py-api", audience: "escape-py-web" };

// O JWT carrega apenas o id e a versão da sessão; papel e permissões são lidos do banco a cada requisição
export function emitirSessao(ctx, usuario) {
  const token = jwt.sign({ ver: usuario.sessionVersion || 0 }, ctx.config.jwt.segredo, {
    ...OPCOES,
    algorithm: "HS256",
    subject: String(usuario._id),
    expiresIn: ctx.config.jwt.validade
  });
  return { etapa: "concluido", token, usuario: dadosProprios(usuario) };
}

export function lerSessao(ctx, token) {
  return jwt.verify(token, ctx.config.jwt.segredo, { ...OPCOES, algorithms: ["HS256"] });
}
