import { ErroHttp } from "../utils/erros.js";

export function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: { codigo: "ROTA_INEXISTENTE", mensagem: "Rota não encontrada." } });
}

// Erros esperados viram respostas com código; os demais são registrados e respondem 500 sem detalhes internos
export function tratarErros(erro, req, res, next) {
  if (res.headersSent) return next(erro);

  if (erro instanceof ErroHttp) {
    return res.status(erro.status).json({ erro: { codigo: erro.codigo, mensagem: erro.message, ...erro.extras } });
  }
  if (erro.type === "entity.parse.failed") {
    return res.status(400).json({ erro: { codigo: "JSON_INVALIDO", mensagem: "O corpo da requisição não é um JSON válido." } });
  }
  if (erro.type === "entity.too.large") {
    return res.status(413).json({ erro: { codigo: "CORPO_GRANDE", mensagem: "Os dados enviados são grandes demais." } });
  }
  if (erro.message === "ORIGEM_NAO_PERMITIDA") {
    return res.status(403).json({ erro: { codigo: "ORIGEM_NAO_PERMITIDA", mensagem: "Origem não autorizada." } });
  }

  console.error("[erro]", req.method, req.originalUrl, erro);
  res.status(500).json({ erro: { codigo: "ERRO_INTERNO", mensagem: "Erro interno. Tente novamente em instantes." } });
}
