import { lerSessao } from "../services/sessao.js";
import { buscarPorId } from "../services/usuarios.js";
import { naoAutenticado, proibido } from "../utils/erros.js";

export async function autenticar(req, res, next) {
  const [esquema, token] = (req.get("authorization") || "").split(" ");
  if (esquema !== "Bearer" || !token) throw naoAutenticado("Faça login para continuar.", "TOKEN_AUSENTE");

  let dados;
  try {
    dados = lerSessao(req.ctx, token);
  } catch {
    throw naoAutenticado("Sua sessão expirou. Entre novamente.", "TOKEN_INVALIDO");
  }

  // Redefinir a senha incrementa sessionVersion e derruba as sessões anteriores
  const usuario = await buscarPorId(req.ctx, dados.sub);
  if (!usuario || (usuario.sessionVersion || 0) !== dados.ver) {
    throw naoAutenticado("Sua sessão expirou. Entre novamente.", "TOKEN_INVALIDO");
  }
  req.usuario = usuario;
  req.sessaoEmitidaEm = dados.iat * 1000;
  next();
}

export function exigirEmailVerificado(req, res, next) {
  if (!req.usuario.emailVerified) throw proibido("Confirme seu e-mail para acessar esta área.", "EMAIL_NAO_VERIFICADO");
  next();
}

export function exigirPerfil(req, res, next) {
  if (!req.usuario.profileComplete) throw proibido("Finalize seu perfil para continuar.", "PERFIL_INCOMPLETO");
  next();
}

export function exigirAdmin(req, res, next) {
  if (req.usuario.role !== "admin") throw proibido("Área restrita a administradores.", "SOMENTE_ADMIN");
  next();
}

export const jogador = [autenticar, exigirEmailVerificado, exigirPerfil];
