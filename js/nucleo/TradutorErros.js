// Mensagem para erros inesperados; os erros da API já chegam com a mensagem pronta (ErroApi)

export class TradutorErros {
  static traduzir(erro, padrao = "Não foi possível concluir a operação.") {
    console.warn("[Escape.py]", erro);
    return padrao;
  }
}
