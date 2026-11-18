// Erro com status HTTP, código estável (usado pelo front) e mensagem para o usuário
export class ErroHttp extends Error {
  constructor(status, codigo, mensagem, extras = undefined) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
    this.extras = extras;
  }
}

export const requisicaoInvalida = (mensagem, codigo = "DADOS_INVALIDOS") => new ErroHttp(400, codigo, mensagem);
export const naoAutenticado = (mensagem = "Faça login para continuar.", codigo = "NAO_AUTENTICADO") => new ErroHttp(401, codigo, mensagem);
export const proibido = (mensagem = "Operação não autorizada.", codigo = "PROIBIDO") => new ErroHttp(403, codigo, mensagem);
export const naoEncontrado = (mensagem = "Registro não encontrado.", codigo = "NAO_ENCONTRADO") => new ErroHttp(404, codigo, mensagem);
export const conflito = (mensagem, codigo = "CONFLITO") => new ErroHttp(409, codigo, mensagem);
export const muitasTentativas = (mensagem = "Muitas tentativas. Aguarde alguns minutos.", codigo = "MUITAS_TENTATIVAS") => new ErroHttp(429, codigo, mensagem);
export const indisponivel = (mensagem, codigo = "INDISPONIVEL") => new ErroHttp(503, codigo, mensagem);

export function ehChaveDuplicada(erro, campo) {
  return erro?.code === 11000 && (!campo || Object.hasOwn(erro.keyPattern || {}, campo));
}
