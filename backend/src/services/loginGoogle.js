import { tokenAleatorio } from "../utils/segredos.js";
import { ErroHttp, ehChaveDuplicada } from "../utils/erros.js";
import { registrarAuditoria } from "./auditoria.js";
import { concluirPrimeiroFator, desafioLegado, exigirLegado, finalizarMigracao } from "./autenticacao.js";
import { emitirSessao } from "./sessao.js";
import { consumirToken, criarToken } from "./tokensUsoUnico.js";
import { buscarPorEmail, buscarPorId, novoUsuario } from "./usuarios.js";

const VERSAO_TERMOS = "1.0";
const PROXIMO_VALIDO = /^[a-z-]+\.html(\?[\w=&%.-]*)?$/;
const expirado = () => new ErroHttp(401, "CODIGO_EXPIRADO", "O login com o Google expirou. Tente novamente.");

function paginaDeLogin(ctx, parametros) {
  const url = new URL(`${ctx.config.frontendUrl}/login.html`);
  Object.entries(parametros).forEach(([chave, valor]) => valor && url.searchParams.set(chave, valor));
  return url.href;
}

export async function iniciarLoginGoogle(ctx, { origem, proximo }) {
  if (!ctx.google) return { redirecionar: paginaDeLogin(ctx, { erro: "google_indisponivel" }) };

  const nonce = tokenAleatorio();
  const verificador = tokenAleatorio(48);
  const state = await criarToken(ctx, {
    tipo: "oauth-google", minutos: 10,
    dados: {
      nonce, verificador,
      origem: origem === "cadastro" ? "cadastro" : "login",
      proximo: typeof proximo === "string" && PROXIMO_VALIDO.test(proximo) ? proximo : ""
    }
  });
  return { redirecionar: ctx.google.urlAutorizacao({ state, nonce, verificador }), state };
}

// Retorno do Google: confere o state (cookie do navegador + registro no banco), troca o código e valida o id_token
export async function concluirLoginGoogle(ctx, { code, state, error, stateDoCookie }) {
  if (!ctx.google) return paginaDeLogin(ctx, { erro: "google_indisponivel" });
  if (error) return paginaDeLogin(ctx, { erro: "google_cancelado" });
  if (typeof state !== "string" || !state || state !== stateDoCookie) return paginaDeLogin(ctx, { erro: "google_estado" });

  const registro = await consumirToken(ctx, state, "oauth-google");
  if (!registro) return paginaDeLogin(ctx, { erro: "google_expirado" });

  let identidade;
  let idToken;
  try {
    idToken = await ctx.google.trocarCodigo(String(code || ""), registro.data.verificador);
    identidade = await ctx.google.validarIdToken(idToken, registro.data.nonce);
  } catch (e) {
    console.error("[google]", e.message);
    return paginaDeLogin(ctx, { erro: "google_falhou" });
  }

  let resultado;
  try {
    resultado = await entrarComGoogle(ctx, identidade, idToken, registro.data.origem);
  } catch (e) {
    if (!(e instanceof ErroHttp)) throw e;
    return paginaDeLogin(ctx, { erro: e.codigo.toLowerCase() });
  }

  // O front recebe só um código de uso único e curta duração; o JWT nunca aparece na URL
  const concluido = resultado.etapa === "concluido";
  const codigo = await criarToken(ctx, {
    tipo: "google-entrega", minutos: 2,
    usuarioId: concluido ? resultado.usuario.uid : null,
    dados: concluido ? { etapa: "concluido" } : { etapa: resultado.etapa, desafio: resultado.desafio }
  });
  return paginaDeLogin(ctx, { google: codigo, proximo: registro.data.proximo });
}

export async function entregarLoginGoogle(ctx, codigo) {
  const registro = await consumirToken(ctx, codigo, "google-entrega");
  if (!registro) throw expirado();
  if (registro.data.etapa !== "concluido") return registro.data;
  const usuario = await buscarPorId(ctx, registro.userId);
  if (!usuario) throw expirado();
  return emitirSessao(ctx, usuario);
}

// Vincula a identidade Google à conta certa sem criar duplicatas
export async function entrarComGoogle(ctx, identidade, idToken, origem) {
  const usuarios = ctx.db.collection("users");
  const usuario = await usuarios.findOne({ googleSub: identidade.sub }) || await buscarPorEmail(ctx, identidade.email);

  if (usuario?.legacy?.pendingTwoFactor) {
    exigirLegado(ctx);
    return entrarPeloLegado(ctx, identidade, idToken, usuario);
  }
  if (!usuario) return ctx.legado ? entrarPeloLegado(ctx, identidade, idToken, null) : criarContaGoogle(ctx, identidade, origem);

  if (usuario.googleSub && usuario.googleSub !== identidade.sub) {
    throw new ErroHttp(409, "GOOGLE_OUTRA_CONTA", "Esta conta já está vinculada a outra conta Google.");
  }
  if (!usuario.googleSub) {
    // E-mail cadastrado e nunca confirmado: quem comprovou o e-mail pelo Google assume a conta e a senha antiga é descartada
    const atualizacao = usuario.emailVerified
      ? { $set: { googleSub: identidade.sub, updatedAt: new Date() } }
      : { $set: { googleSub: identidade.sub, emailVerified: true, passwordHash: null, updatedAt: new Date() }, $inc: { sessionVersion: 1 } };
    await usuarios.updateOne({ _id: usuario._id }, atualizacao);
    await registrarAuditoria(ctx, usuario, "google_vinculado");
  }
  return concluirPrimeiroFator(ctx, await buscarPorId(ctx, usuario._id), "Google");
}

async function entrarPeloLegado(ctx, identidade, idToken, existente) {
  const resultado = await ctx.legado.entrarComGoogle(idToken);
  if (resultado.situacao === "mfa") {
    return desafioLegado(ctx, resultado, { senhaHash: null, googleSub: identidade.sub, existenteId: existente?._id || null });
  }
  if (resultado.situacao === "ok") {
    return finalizarMigracao(ctx, { idToken: resultado.idToken, googleSub: identidade.sub, existente }, "Google (conta migrada)");
  }
  // A conta Google não existia no Firebase
  if (!existente) return criarContaGoogle(ctx, identidade, "login");
  await ctx.db.collection("users").updateOne(
    { _id: existente._id },
    { $unset: { "legacy.pendingTwoFactor": "" }, $set: { googleSub: identidade.sub, updatedAt: new Date() } }
  );
  return concluirPrimeiroFator(ctx, await buscarPorId(ctx, existente._id), "Google");
}

async function criarContaGoogle(ctx, identidade, origem) {
  const usuario = novoUsuario({
    email: identidade.email,
    name: identidade.name.slice(0, 60),
    emailVerified: true,
    extras: { googleSub: identidade.sub, termsVersion: VERSAO_TERMOS, termsAcceptedAt: new Date() }
  });
  try {
    usuario._id = (await ctx.db.collection("users").insertOne(usuario)).insertedId;
  } catch (e) {
    if (ehChaveDuplicada(e)) throw new ErroHttp(409, "CONTA_EM_USO", "Já existe uma conta com este e-mail. Tente entrar novamente.");
    throw e;
  }
  await registrarAuditoria(ctx, usuario, "cadastro", `Google (${origem})`);
  await registrarAuditoria(ctx, usuario, "termos_aceitos", `Termo de Aceite e Política de Privacidade v${VERSAO_TERMOS}`);
  return concluirPrimeiroFator(ctx, usuario, "Google");
}
