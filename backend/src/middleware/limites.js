import { rateLimit } from "express-rate-limit";

function limitador({ janelaMinutos, maximo, mensagem }) {
  return rateLimit({
    windowMs: janelaMinutos * 60 * 1000,
    limit: maximo,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ erro: { codigo: "MUITAS_TENTATIVAS", mensagem } })
  });
}

export function criarLimites({ autenticacao = 20, geral = 600 } = {}) {
  return {
    autenticacao: limitador({ janelaMinutos: 15, maximo: autenticacao, mensagem: "Muitas tentativas. Aguarde alguns minutos e tente novamente." }),
    geral: limitador({ janelaMinutos: 5, maximo: geral, mensagem: "Muitas requisições. Aguarde um pouco." })
  };
}
