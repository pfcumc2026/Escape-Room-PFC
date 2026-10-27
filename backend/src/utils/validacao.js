import { ObjectId } from "mongodb";
import { requisicaoInvalida } from "./erros.js";

export const LIMITES = {
  nomeMax: 60,
  senhaMin: 8,
  senhaMax: 72,
  usernameMin: 3,
  usernameMax: 20,
  grupoMin: 3,
  grupoMax: 30,
  mensagemMax: 300
};

export const ESTILOS_AVATAR = ["bottts", "shapes", "identicon", "thumbs", "pixel-art", "rings", "glass", "icons"];
export const ID_CHAVE = /^[A-Za-z0-9_-]{1,40}$/;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Garante que um campo é texto: impede objetos como { "$gt": "" } nas consultas
export function texto(valor, campo, { obrigatorio = true, max = 500 } = {}) {
  if (valor === undefined || valor === null || valor === "") {
    if (obrigatorio) throw requisicaoInvalida(`Informe ${campo}.`);
    return "";
  }
  if (typeof valor !== "string") throw requisicaoInvalida(`O campo ${campo} é inválido.`);
  return valor.replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizarEmail(valor) {
  const email = texto(valor, "o e-mail", { max: 254 }).toLowerCase();
  if (!EMAIL.test(email)) throw requisicaoInvalida("Digite um e-mail válido.", "EMAIL_INVALIDO");
  return email;
}

// bcrypt considera apenas os primeiros 72 bytes, por isso o limite superior
export function validarSenha(valor) {
  if (typeof valor !== "string" || !valor) throw requisicaoInvalida("Informe a senha.");
  if (valor.length < LIMITES.senhaMin) throw requisicaoInvalida(`A senha precisa ter pelo menos ${LIMITES.senhaMin} caracteres.`, "SENHA_FRACA");
  if (Buffer.byteLength(valor) > LIMITES.senhaMax) throw requisicaoInvalida(`A senha pode ter no máximo ${LIMITES.senhaMax} caracteres.`, "SENHA_LONGA");
  if (!/[a-zA-Z]/.test(valor) || !/[0-9]/.test(valor)) throw requisicaoInvalida("A senha precisa conter letras e números.", "SENHA_FRACA");
  return valor;
}

export function validarUsername(valor) {
  const username = texto(valor, "o username", { max: 40 });
  if (username.length < LIMITES.usernameMin || username.length > LIMITES.usernameMax || !/^[a-zA-Z0-9_]+$/.test(username)) {
    throw requisicaoInvalida(`Use de ${LIMITES.usernameMin} a ${LIMITES.usernameMax} caracteres: letras, números e underline.`, "USERNAME_INVALIDO");
  }
  return username;
}

export function codigoNumerico(valor) {
  const codigo = typeof valor === "string" ? valor.replace(/\D/g, "") : "";
  if (codigo.length !== 6) throw requisicaoInvalida("Digite os 6 dígitos do código.", "CODIGO_INVALIDO");
  return codigo;
}

export function inteiro(valor, campo, min, max) {
  if (!Number.isInteger(valor) || valor < min || valor > max) throw requisicaoInvalida(`O campo ${campo} é inválido.`);
  return valor;
}

export function objectId(valor) {
  return typeof valor === "string" && ObjectId.isValid(valor) && String(new ObjectId(valor)) === valor ? new ObjectId(valor) : null;
}

export function ehObjetoSimples(valor) {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}
