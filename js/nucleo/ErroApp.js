// Violação de regra de negócio, já com mensagem pronta para o usuário

export class ErroApp extends Error {
  constructor(mensagem, { tipo = "err", duracao = 4200 } = {}) {
    super(mensagem);
    this.name = "ErroApp";
    this.tipo = tipo;
    this.duracao = duracao;
  }
}
