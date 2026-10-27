import crypto from "node:crypto";
import * as OTPAuth from "otpauth";
import { cifrar, decifrar, hashToken } from "../utils/segredos.js";
import { requisicaoInvalida } from "../utils/erros.js";

const EMISSOR = "Escape.py";
const PERIODO = 30;
const QUANTIDADE_RECUPERACAO = 10;
const ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789";

function totp(segredoBase32, rotulo = "") {
  return new OTPAuth.TOTP({
    issuer: EMISSOR, label: rotulo, algorithm: "SHA1", digits: 6, period: PERIODO,
    secret: OTPAuth.Secret.fromBase32(segredoBase32)
  });
}

// Retorna o passo de tempo do código válido (tolerância de um período para cada lado) ou null
function passoValido(segredoBase32, codigo) {
  const delta = totp(segredoBase32).validate({ token: codigo, window: 1 });
  return delta === null ? null : Math.floor(Date.now() / 1000 / PERIODO) + delta;
}

function normalizarRecuperacao(codigo) {
  return String(codigo || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function novoCodigoRecuperacao() {
  const bytes = crypto.randomBytes(10);
  const letras = Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
  return `${letras.slice(0, 5)}-${letras.slice(5)}`;
}

function novosCodigosRecuperacao() {
  return Array.from({ length: QUANTIDADE_RECUPERACAO }, novoCodigoRecuperacao);
}

function hashRecuperacao(codigo) {
  return hashToken(normalizarRecuperacao(codigo));
}

export async function prepararConfiguracao(ctx, usuario) {
  const segredo = new OTPAuth.Secret({ size: 20 }).base32;
  await ctx.db.collection("users").updateOne(
    { _id: usuario._id },
    { $set: { "twoFactor.pendingSecret": cifrar(segredo, ctx.config.chaveTotp), updatedAt: new Date() } }
  );
  return { secret: segredo, uri: totp(segredo, usuario.email).toString() };
}

// Só ativa depois que o primeiro código gerado pelo aplicativo confere
export async function ativar(ctx, usuario, codigo) {
  const pendente = usuario.twoFactor?.pendingSecret;
  if (!pendente) throw requisicaoInvalida("Gere um novo QR Code para ativar o 2FA.", "CONFIGURACAO_2FA_AUSENTE");
  const segredo = decifrar(pendente, ctx.config.chaveTotp);
  const passo = passoValido(segredo, codigo);
  if (passo === null) throw requisicaoInvalida("Código inválido. Confira o aplicativo autenticador.", "CODIGO_INVALIDO");

  const codigos = novosCodigosRecuperacao();
  await ctx.db.collection("users").updateOne({ _id: usuario._id }, {
    $set: {
      twoFactor: {
        enabled: true,
        secret: pendente,
        lastUsedStep: passo,
        recoveryCodes: codigos.map(hashRecuperacao),
        enabledAt: new Date()
      },
      updatedAt: new Date()
    },
    $unset: { "legacy.pendingTwoFactor": "" }
  });
  return codigos;
}

// Aceita um código TOTP ainda não usado ou um código de recuperação, que é descartado ao ser aceito
export async function conferirSegundoFator(ctx, usuario, { code, recoveryCode }) {
  const usuarios = ctx.db.collection("users");
  if (recoveryCode) {
    const hash = hashRecuperacao(recoveryCode);
    const r = await usuarios.updateOne(
      { _id: usuario._id, "twoFactor.recoveryCodes": hash },
      { $pull: { "twoFactor.recoveryCodes": hash } }
    );
    return r.modifiedCount === 1;
  }
  if (!usuario.twoFactor?.secret || !/^\d{6}$/.test(code || "")) return false;
  const passo = passoValido(decifrar(usuario.twoFactor.secret, ctx.config.chaveTotp), code);
  if (passo === null) return false;
  // Impede que o mesmo código seja reaproveitado dentro da janela de validade
  const r = await usuarios.updateOne(
    { _id: usuario._id, "twoFactor.lastUsedStep": { $lt: passo } },
    { $set: { "twoFactor.lastUsedStep": passo } }
  );
  return r.modifiedCount === 1;
}

// Os códigos anteriores deixam de valer: só a lista nova é guardada
export async function regenerarCodigos(ctx, usuario) {
  const codigos = novosCodigosRecuperacao();
  await ctx.db.collection("users").updateOne(
    { _id: usuario._id, "twoFactor.enabled": true },
    { $set: { "twoFactor.recoveryCodes": codigos.map(hashRecuperacao), updatedAt: new Date() } }
  );
  return codigos;
}

export async function desativar(ctx, usuario) {
  await ctx.db.collection("users").updateOne(
    { _id: usuario._id },
    { $set: { twoFactor: { enabled: false }, updatedAt: new Date() } }
  );
}
