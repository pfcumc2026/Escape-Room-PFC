// Formas narrativas de apresentar o valor de uma pista ao jogador

export class Pista {
  static SABORES = {
    anotacao: { nome: "Anotação entre páginas", texto: "Entre as páginas, uma anotação em tinta desbotada: «{valor}»." },
    inscricao: { nome: "Inscrição gravada", texto: "Uma inscrição gravada com cuidado no material: «{valor}»." },
    pergaminho: { nome: "Pergaminho amarelado", texto: "Um pergaminho amarelado traz uma nota curta: «{valor}»." },
    marca: { nome: "Marcas riscadas", texto: "Marcas riscadas às pressas formam a mensagem: «{valor}»." }
  };

  static ids() {
    return Object.keys(Pista.SABORES);
  }

  static texto(saborId, valor) {
    const sabor = Pista.SABORES[saborId] || Pista.SABORES.anotacao;
    return sabor.texto.replace("{valor}", valor);
  }
}
