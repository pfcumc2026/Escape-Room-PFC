// Catálogo de enigmas de Python. Cada modelo sorteia seus parâmetros a partir da semente da variante

export class ModeloEnigma {
  constructor(dados) {
    Object.assign(this, dados);
  }
}

const PALAVRAS = ["tocha", "chave", "dragao", "castelo", "cripta", "brasao", "espada", "coroa", "torre", "grimorio"];
const NOMES = ["aldric", "berengar", "cedric", "elowen", "gwendal", "isolde", "morgana", "percival", "rowena", "tristao"];
const FRASES = [
  "a chave dorme sob o tapete", "lua sobre a torre antiga", "siga o corvo ate o portao",
  "o rei esconde o mapa", "abra a porta do sul", "tres velas guardam o segredo"
];

const primo = (n) => {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
};

const listaAleatoria = (rng, tamanho, min, max) => Array.from({ length: tamanho }, () => rng.inteiro(min, max));

export class ModelosEnigma {
  static TODOS = [
    // Fácil: variáveis, aritmética, strings e condições
    new ModeloEnigma({
      id: "chave-numerica", nivel: "facil", conceito: "Variáveis e aritmética",
      titulo: "A chave do cadeado", nomeFuncao: "gerar_chave", parametros: ["id"],
      sortear: (r) => ({ a: r.inteiro(3, 9), b: r.inteiro(1, 9) }),
      f: (p, id) => id * p.a - p.b,
      casos: () => [[10], [0], [-5], [7], [100], [1]],
      entrada: (p, r) => [r.inteiro(11, 40)],
      historia: (p) => `A fechadura antiga aceita um número de identificação, mas ele precisa ser transformado na chave correta. Complete a função gerar_chave(id): multiplique o identificador por ${p.a} e depois subtraia ${p.b}.`,
      dicas: (p) => [
        "A fechadura exige duas operações matemáticas.",
        "A multiplicação acontece antes da subtração.",
        `Tente algo como: return id * ${p.a} - ${p.b}`
      ]
    }),
    new ModeloEnigma({
      id: "area-livre", nivel: "facil", conceito: "Variáveis e aritmética",
      titulo: "O tapete manchado", nomeFuncao: "area_livre", parametros: ["largura", "comprimento"],
      sortear: (r) => ({ mancha: r.inteiro(2, 9) }),
      f: (p, l, c) => l * c - p.mancha,
      casos: () => [[4, 5], [10, 10], [3, 3], [1, 20], [7, 6], [12, 2]],
      entrada: (p, r) => [r.inteiro(6, 15), r.inteiro(6, 15)],
      historia: (p) => `Um tapete retangular guarda uma mensagem sob uma mancha de ${p.mancha} unidades de área. Complete area_livre(largura, comprimento) para devolver a área do tapete descontada a mancha.`,
      dicas: (p) => [
        "A área de um retângulo é largura vezes comprimento.",
        "Depois de calcular a área, desconte a mancha.",
        `Tente: return largura * comprimento - ${p.mancha}`
      ]
    }),
    new ModeloEnigma({
      id: "selo-de-nome", nivel: "facil", conceito: "Strings",
      titulo: "O selo do nome", nomeFuncao: "selo", parametros: ["nome"],
      sortear: () => ({}),
      f: (p, nome) => nome.toUpperCase() + String(nome.length),
      casos: () => [["aldric"], ["rei"], ["isolde"], ["a"], ["percival"], ["morgana"]],
      entrada: (p, r) => [r.escolher(NOMES)],
      historia: () => "Cada nobre assina com um selo: o nome em letras maiúsculas seguido da quantidade de letras do nome. Complete selo(nome). Por exemplo, selo('rei') devolve 'REI3'.",
      dicas: () => [
        "Strings têm métodos para mudar a caixa das letras.",
        "A função len() conta quantos caracteres existem. Para juntar número e texto, converta com str().",
        "Tente: return nome.upper() + str(len(nome))"
      ]
    }),
    new ModeloEnigma({
      id: "balanca-da-porta", nivel: "facil", conceito: "Condições (if / else)",
      titulo: "A balança da porta", nomeFuncao: "ajustar", parametros: ["peso"],
      sortear: (r) => ({ limite: r.inteiro(10, 30), bonus: r.inteiro(2, 9) }),
      f: (p, peso) => (peso >= p.limite ? peso * 2 : peso + p.bonus),
      casos: (p) => [[p.limite], [p.limite - 1], [p.limite + 5], [0], [1], [p.limite * 2]],
      entrada: (p, r) => [Math.max(1, r.inteiro(p.limite - 8, p.limite + 12))],
      historia: (p) => `Uma balança mágica ajusta o peso colocado sobre ela. Se o peso for maior ou igual a ${p.limite}, o ajuste é o dobro do peso. Caso contrário, é o peso somado a ${p.bonus}. Complete ajustar(peso).`,
      dicas: (p) => [
        "O resultado depende de uma comparação: use if e else.",
        `A condição é 'peso maior ou igual a ${p.limite}'.`,
        `Tente: if peso >= ${p.limite}: return peso * 2  e, no caso contrário, return peso + ${p.bonus}`
      ]
    }),

    // Médio: laços, listas, strings e funções
    new ModeloEnigma({
      id: "soma-pares", nivel: "medio", conceito: "Laços e listas",
      titulo: "Os números pares", nomeFuncao: "soma_pares", parametros: ["numeros"],
      sortear: () => ({}),
      f: (p, numeros) => numeros.filter((n) => n % 2 === 0).reduce((a, b) => a + b, 0),
      casos: () => [[[1, 2, 3, 4]], [[]], [[1, 3, 5]], [[2, 4, 6]], [[10, 15, 20, 25]], [[7, 8, 9, 10, 11, 12]]],
      entrada: (p, r) => [listaAleatoria(r, r.inteiro(6, 8), 1, 30)],
      historia: () => "Os mecanismos só respondem a números pares. Complete soma_pares(numeros) para devolver a soma apenas dos números pares da lista.",
      dicas: () => [
        "Percorra a lista com um laço for.",
        "Um número é par quando o resto da divisão por 2 é zero (n % 2 == 0).",
        "Crie um acumulador começando em 0 e some n a ele apenas quando n % 2 == 0."
      ]
    }),
    new ModeloEnigma({
      id: "soma-acima", nivel: "medio", conceito: "Listas e condições",
      titulo: "O peso dos volumes", nomeFuncao: "soma_acima", parametros: ["numeros", "limite"],
      sortear: () => ({}),
      f: (p, numeros, limite) => numeros.filter((n) => n > limite).reduce((a, b) => a + b, 0),
      casos: () => [[[1, 5, 10], 4], [[], 3], [[3, 3, 3], 3], [[9, 8, 7], 0], [[2, 4, 6, 8], 5], [[-5, 5, 15], -1]],
      entrada: (p, r) => [listaAleatoria(r, r.inteiro(6, 8), 1, 25), r.inteiro(5, 14)],
      historia: () => "Os volumes da estante têm pesos diferentes e só os mais pesados importam. Complete soma_acima(numeros, limite) para somar apenas os valores estritamente maiores que o limite.",
      dicas: () => [
        "Percorra a lista e compare cada valor com o limite.",
        "'Estritamente maior' significa usar > e não >=.",
        "Acumule em uma variável: if n > limite: total += n"
      ]
    }),
    new ModeloEnigma({
      id: "cifra-de-cesar", nivel: "medio", conceito: "Strings e laços",
      titulo: "A cifra do escriba", nomeFuncao: "cifrar", parametros: ["mensagem", "deslocamento"],
      sortear: () => ({}),
      f: (p, msg, k) => [...msg].map((c) => (c >= "a" && c <= "z" ? String.fromCharCode(((c.charCodeAt(0) - 97 + k) % 26) + 97) : c)).join(""),
      casos: () => [["abc", 1], ["xyz", 3], ["ola mundo", 2], ["", 5], ["zebra", 1], ["torre", 4]],
      entrada: (p, r) => [r.escolher(PALAVRAS), r.inteiro(1, 5)],
      historia: () => "O escriba desloca cada letra minúscula k posições no alfabeto (depois do 'z' volta ao 'a'). Outros caracteres, como espaços, ficam como estão. Complete cifrar(mensagem, deslocamento). Exemplo: cifrar('abc', 1) devolve 'bcd'.",
      dicas: () => [
        "Percorra a mensagem caractere por caractere.",
        "ord() converte uma letra em número e chr() faz o caminho inverso. Use % 26 para dar a volta no alfabeto.",
        "chr((ord(c) - ord('a') + deslocamento) % 26 + ord('a')) desloca uma letra minúscula."
      ]
    }),
    new ModeloEnigma({
      id: "soma-quadrados", nivel: "medio", conceito: "Funções e laços",
      titulo: "Os degraus da torre", nomeFuncao: "soma_quadrados", parametros: ["n"],
      sortear: () => ({}),
      f: (p, n) => { let t = 0; for (let i = 1; i <= n; i++) t += i * i; return t; },
      casos: () => [[1], [2], [3], [5], [10], [0]],
      entrada: (p, r) => [r.inteiro(6, 14)],
      historia: () => "Cada degrau da torre pesa o quadrado do seu número (1, 4, 9, ...). Complete soma_quadrados(n) para devolver o peso total dos degraus de 1 até n.",
      dicas: () => [
        "Use um laço com range().",
        "range(1, n + 1) percorre de 1 até n.",
        "Some i * i a um acumulador a cada volta."
      ]
    }),
    new ModeloEnigma({
      id: "frase-invertida", nivel: "medio", conceito: "Strings e listas",
      titulo: "A mensagem espelhada", nomeFuncao: "inverter_frase", parametros: ["frase"],
      sortear: () => ({}),
      f: (p, frase) => frase.split(/\s+/).filter(Boolean).reverse().join(" "),
      casos: () => [["um dois tres"], ["lua"], ["abra a porta"], ["a b c d"], ["rei e rainha"], ["de tras para frente"]],
      entrada: (p, r) => [r.escolher(FRASES)],
      historia: () => "Uma mensagem secreta foi escrita de trás para a frente, palavra por palavra. Complete inverter_frase(frase) para devolver as palavras na ordem inversa, separadas por um espaço.",
      dicas: () => [
        "Quebre a frase em palavras com split().",
        "Listas podem ser invertidas com [::-1] ou reversed().",
        "Junte de volta com ' '.join(palavras)."
      ]
    }),

    // Difícil: lógica aninhada, algoritmos e vários passos
    new ModeloEnigma({
      id: "soma-matriz", nivel: "dificil", conceito: "Listas aninhadas e laços",
      titulo: "O tabuleiro de runas", nomeFuncao: "soma_matriz", parametros: ["matriz", "limite"],
      sortear: () => ({}),
      f: (p, m, limite) => m.flat().filter((v) => v > limite).reduce((a, b) => a + b, 0),
      casos: () => [[[[1, 2], [3, 4]], 2], [[[5]], 5], [[[1, 9], [9, 1], [5, 5]], 4], [[[]], 0], [[[10, 20, 30], [1, 2, 3]], 15], [[[-1, -2], [3, 4]], -2]],
      entrada: (p, r) => [Array.from({ length: r.inteiro(3, 4) }, () => listaAleatoria(r, 3, 1, 20)), r.inteiro(5, 12)],
      historia: () => "As runas estão dispostas em linhas e colunas (uma lista de listas). Só as runas com valor maior que o limite brilham. Complete soma_matriz(matriz, limite) para somar o valor de todas as runas que brilham.",
      dicas: () => [
        "São duas camadas de lista: você precisa de um laço dentro de outro.",
        "O laço externo percorre as linhas e o interno percorre os valores de cada linha.",
        "for linha in matriz: for v in linha: if v > limite: total += v"
      ]
    }),
    new ModeloEnigma({
      id: "segundo-maior", nivel: "dificil", conceito: "Algoritmos e listas",
      titulo: "O segundo colocado", nomeFuncao: "segundo_maior", parametros: ["numeros"],
      sortear: () => ({}),
      f: (p, numeros) => [...new Set(numeros)].sort((a, b) => b - a)[1],
      casos: () => [[[5, 5, 3]], [[1, 2]], [[9, 9, 9, 7]], [[-3, -1, -2]], [[4, 8, 6, 8, 2]], [[10, 20, 30, 40]]],
      entrada: (p, r) => {
        const base = [...new Set(listaAleatoria(r, 8, 1, 60))];
        return [base.length >= 2 ? base : [base[0], base[0] + 1]];
      },
      historia: () => "Em um torneio, só vale a segunda maior pontuação entre valores diferentes (repetições contam uma vez só). A lista sempre tem ao menos dois valores distintos. Complete segundo_maior(numeros).",
      dicas: () => [
        "Valores repetidos não contam duas vezes. Pense em como eliminá-los.",
        "Descubra o maior valor, remova-o e procure o maior entre os que restam, ignorando repetições do maior.",
        "Uma saída: sorted(set(numeros))[-2] ordena os valores únicos e pega o penúltimo."
      ]
    }),
    new ModeloEnigma({
      id: "contar-primos", nivel: "dificil", conceito: "Laços combinados com condições",
      titulo: "O crivo das estrelas", nomeFuncao: "contar_primos", parametros: ["n"],
      sortear: () => ({}),
      f: (p, n) => { let t = 0; for (let i = 2; i <= n; i++) if (primo(i)) t++; return t; },
      casos: () => [[2], [1], [10], [0], [30], [20]],
      entrada: (p, r) => [r.inteiro(20, 60)],
      historia: () => "As estrelas do teto só acendem nas posições primas. Complete contar_primos(n) para devolver quantos números primos existem entre 1 e n (inclusive). Lembre-se de que 1 não é primo.",
      dicas: () => [
        "Um número primo só é divisível por 1 e por ele mesmo.",
        "Para cada candidato de 2 até n, teste se algum divisor entre 2 e candidato - 1 divide exatamente.",
        "Crie uma função auxiliar eh_primo(x) e conte quantos candidatos passam no teste."
      ]
    }),
    new ModeloEnigma({
      id: "descomprimir", nivel: "dificil", conceito: "Strings e laços",
      titulo: "O pergaminho comprimido", nomeFuncao: "descomprimir", parametros: ["texto"],
      sortear: () => ({}),
      f: (p, texto) => { let s = ""; for (let i = 0; i < texto.length; i += 2) s += texto[i].repeat(Number(texto[i + 1])); return s; },
      casos: () => [["a1"], ["a3b2"], ["x9"], ["z2y1x3"], [""], ["k4"]],
      entrada: (p, r) => {
        const letras = "abcdefghijklmnopqrstuvwxyz";
        let t = "";
        for (let i = 0; i < r.inteiro(3, 4); i++) t += letras[r.inteiro(0, 25)] + r.inteiro(1, 5);
        return [t];
      },
      historia: () => "Um pergaminho foi comprimido: cada letra é seguida por um dígito (de 1 a 9) que diz quantas vezes ela se repete. Complete descomprimir(texto). Exemplo: descomprimir('a3b2') devolve 'aaabb'.",
      dicas: () => [
        "O texto é formado por pares: uma letra e um dígito.",
        "Percorra de 2 em 2 posições (range(0, len(texto), 2)) e leia letra e dígito.",
        "int(dígito) converte o caractere em número; letra * quantidade repete a letra."
      ]
    }),
    new ModeloEnigma({
      id: "fibonacci-generalizado", nivel: "dificil", conceito: "Laços e raciocínio algorítmico",
      titulo: "A sequência do alquimista", nomeFuncao: "termo", parametros: ["a", "b", "n"],
      sortear: () => ({}),
      f: (p, a, b, n) => { if (n === 1) return a; let x = a, y = b; for (let i = 2; i < n; i++) [x, y] = [y, x + y]; return y; },
      casos: () => [[1, 1, 1], [2, 3, 2], [1, 1, 6], [2, 5, 5], [0, 1, 10], [3, 1, 4]],
      entrada: (p, r) => [r.inteiro(1, 5), r.inteiro(1, 5), r.inteiro(8, 12)],
      historia: () => "O alquimista começa uma sequência com dois números, a e b. Cada termo seguinte é a soma dos dois anteriores. O primeiro termo é a, o segundo é b. Complete termo(a, b, n) para devolver o n-ésimo termo (n >= 1).",
      dicas: () => [
        "Guarde os dois últimos termos em variáveis e atualize-os a cada passo.",
        "Trate n == 1 e n == 2 separadamente; para os demais, repita a soma n - 2 vezes.",
        "No laço: a, b = b, a + b. No fim, b é o n-ésimo termo (para n >= 2)."
      ]
    }),
    new ModeloEnigma({
      id: "passos-collatz", nivel: "dificil", conceito: "Laços while e condições",
      titulo: "A escada do mago", nomeFuncao: "passos", parametros: ["n"],
      sortear: () => ({}),
      f: (p, n) => { let c = 0; while (n !== 1) { n = n % 2 === 0 ? n / 2 : 3 * n + 1; c++; } return c; },
      casos: () => [[1], [2], [6], [7], [27], [3]],
      entrada: (p, r) => [r.inteiro(6, 27)],
      historia: () => "O mago sobe uma escada começando no degrau n. Se o degrau for par, ele vai para a metade dele; se for ímpar, vai para o triplo mais 1. Ele para ao chegar no degrau 1. Complete passos(n) para devolver quantos movimentos ele fez (passos(1) devolve 0).",
      dicas: () => [
        "Você não sabe de antemão quantas repetições serão necessárias: pense em while.",
        "Enquanto n for diferente de 1, aplique a regra de par/ímpar e conte um passo.",
        "Use n // 2 para a metade inteira e 3 * n + 1 para o caso ímpar."
      ]
    }),

    // Novos enigmas: fácil
    new ModeloEnigma({
      id: "perimetro-corrigido", nivel: "facil", conceito: "Corrigir o erro",
      titulo: "O perímetro do salão", nomeFuncao: "perimetro", parametros: ["largura", "altura"],
      sortear: () => ({}),
      f: (p, l, a) => 2 * (l + a),
      casos: () => [[4, 5], [10, 10], [1, 1], [3, 8], [7, 2], [0, 5]],
      entrada: (p, r) => [r.inteiro(6, 20), r.inteiro(6, 20)],
      codigoInicial: () => "def perimetro(largura, altura):\n    # este código tem um erro: encontre e corrija\n    return largura + altura * 2\n",
      historia: () => "O escriba mediu o salão, mas errou a fórmula. O perímetro de um retângulo é a soma dos quatro lados. O código abaixo já existe e está errado: corrija perimetro(largura, altura).",
      dicas: () => [
        "Execute o código com alguns números e compare com a conta feita à mão.",
        "O perímetro soma os dois lados de largura e os dois de altura.",
        "Tente: return 2 * (largura + altura)"
      ]
    }),
    new ModeloEnigma({
      id: "moedas-do-mercador", nivel: "facil", conceito: "Condições e aritmética",
      titulo: "As moedas do mercador", nomeFuncao: "total_a_pagar", parametros: ["quantidade", "preco"],
      sortear: (r) => ({ limite: r.inteiro(3, 6), desconto: r.inteiro(5, 15) }),
      f: (p, q, preco) => (q >= p.limite ? q * preco - p.desconto : q * preco),
      casos: (p) => [[1, 10], [p.limite, 10], [p.limite - 1, 7], [p.limite + 4, 3], [0, 9], [p.limite * 2, 20]],
      entrada: (p, r) => [r.inteiro(2, 9), r.inteiro(8, 30)],
      historia: (p) => `Um mercador vende cada item por um preço fixo. Quem leva ${p.limite} itens ou mais ganha ${p.desconto} moedas de desconto no total. Complete total_a_pagar(quantidade, preco).`,
      dicas: (p) => [
        "Primeiro calcule o total sem desconto: quantidade vezes preço.",
        `O desconto só vale quando quantidade >= ${p.limite}.`,
        `Tente: total = quantidade * preco; if quantidade >= ${p.limite}: total = total - ${p.desconto}; return total`
      ]
    }),

    // Novos enigmas: médio
    new ModeloEnigma({
      id: "contar-vogais", nivel: "medio", conceito: "Strings e laços",
      titulo: "As vogais do escriba", nomeFuncao: "contar_vogais", parametros: ["texto"],
      sortear: () => ({}),
      f: (p, texto) => [...texto].filter((c) => "aeiou".includes(c)).length,
      casos: () => [["abacate"], [""], ["rhythm"], ["aeiou"], ["o rei esconde o mapa"], ["xyz"]],
      entrada: (p, r) => [r.escolher(FRASES)],
      historia: () => "Uma mensagem só revela seu valor pelas vogais (a, e, i, o, u, sempre minúsculas e sem acento). Complete contar_vogais(texto) para devolver quantas vogais o texto tem.",
      dicas: () => [
        "Percorra o texto letra por letra.",
        "Você pode testar se uma letra está dentro de 'aeiou' com o operador in.",
        "Some 1 a um contador sempre que letra in 'aeiou'."
      ]
    }),
    new ModeloEnigma({
      id: "maior-valor", nivel: "medio", conceito: "Listas e laços",
      titulo: "O maior tesouro", nomeFuncao: "maior", parametros: ["numeros"],
      sortear: () => ({}),
      f: (p, numeros) => Math.max(...numeros),
      casos: () => [[[3, 9, 2]], [[7]], [[-5, -1, -9]], [[4, 4, 4]], [[1, 2, 3, 4, 5]], [[10, 2, 10, 8]]],
      entrada: (p, r) => [listaAleatoria(r, r.inteiro(6, 8), 1, 90)],
      historia: () => "O cofre só abre com o maior valor de uma lista de tesouros, e a lista nunca está vazia. Complete maior(numeros) sem usar a função max(): percorra a lista guardando o maior valor visto.",
      dicas: () => [
        "Comece assumindo que o primeiro elemento é o maior.",
        "Percorra os demais e atualize a variável quando encontrar um valor maior.",
        "atual = numeros[0]; for n in numeros: if n > atual: atual = n"
      ]
    }),
    new ModeloEnigma({
      id: "fatorial", nivel: "medio", conceito: "Funções e laços",
      titulo: "A pilha de livros", nomeFuncao: "fatorial", parametros: ["n"],
      sortear: () => ({}),
      f: (p, n) => { let t = 1; for (let i = 2; i <= n; i++) t *= i; return t; },
      casos: () => [[0], [1], [2], [3], [5], [6]],
      entrada: (p, r) => [r.inteiro(5, 9)],
      historia: () => "De quantas formas n livros podem ser ordenados na estante? A resposta é o fatorial de n: o produto de todos os números de 1 até n (e o fatorial de 0 vale 1). Complete fatorial(n).",
      dicas: () => [
        "Comece o resultado em 1 e multiplique a cada volta do laço.",
        "range(2, n + 1) percorre os números que importam.",
        "resultado = 1; for i in range(2, n + 1): resultado = resultado * i"
      ]
    }),
    new ModeloEnigma({
      id: "soma-ate-corrigida", nivel: "medio", conceito: "Corrigir o erro",
      titulo: "Os degraus esquecidos", nomeFuncao: "soma_ate", parametros: ["n"],
      sortear: () => ({}),
      f: (p, n) => { let t = 0; for (let i = 1; i <= n; i++) t += i; return t; },
      casos: () => [[1], [2], [3], [5], [10], [0]],
      entrada: (p, r) => [r.inteiro(8, 30)],
      codigoInicial: () => "def soma_ate(n):\n    # este código tem um erro: encontre e corrija\n    total = 0\n    for i in range(1, n):\n        total = total + i\n    return total\n",
      historia: () => "A função soma_ate(n) deve somar os números de 1 até n, inclusive. O escriba deixou uma versão que esquece o último degrau. Corrija o código.",
      dicas: () => [
        "Teste soma_ate(3): o resultado deveria ser 6.",
        "range(1, n) para antes de n.",
        "Troque por range(1, n + 1)."
      ]
    }),
    new ModeloEnigma({
      id: "pares-menos-impares", nivel: "medio", conceito: "Listas e condições",
      titulo: "A balança das runas", nomeFuncao: "saldo", parametros: ["numeros"],
      sortear: () => ({}),
      f: (p, ns) => ns.reduce((t, n) => (n % 2 === 0 ? t + n : t - n), 0),
      casos: () => [[[1, 2, 3, 4]], [[]], [[5, 5]], [[2, 4, 6]], [[10, 3, 7, 8]], [[9]]],
      entrada: (p, r) => [listaAleatoria(r, r.inteiro(6, 8), 1, 40)],
      historia: () => "Runas pares pesam a favor e runas ímpares pesam contra. Complete saldo(numeros) para devolver a soma dos números pares menos a soma dos números ímpares da lista.",
      dicas: () => [
        "Percorra a lista e decida, para cada número, em qual soma ele entra.",
        "Use n % 2 == 0 para reconhecer os pares.",
        "Um acumulador: some n se for par e subtraia n se for ímpar."
      ]
    }),
    new ModeloEnigma({
      id: "soma-digitos", nivel: "medio", conceito: "Laços while e aritmética",
      titulo: "Os dígitos do selo", nomeFuncao: "soma_digitos", parametros: ["n"],
      sortear: () => ({}),
      f: (p, n) => { let t = 0; while (n > 0) { t += n % 10; n = Math.floor(n / 10); } return t; },
      casos: () => [[0], [7], [123], [1000], [9999], [40506]],
      entrada: (p, r) => [r.inteiro(1000, 99999)],
      historia: () => "O selo do rei é um número, e sua força é a soma dos seus dígitos. Complete soma_digitos(n) sem transformar o número em texto: use as operações % 10 e // 10.",
      dicas: () => [
        "n % 10 devolve o último dígito de n.",
        "n // 10 remove o último dígito. Repita enquanto n for maior que zero.",
        "while n > 0: total = total + n % 10; n = n // 10"
      ]
    }),

    // Novos enigmas: difícil
    new ModeloEnigma({
      id: "contar-palindromos", nivel: "dificil", conceito: "Listas e strings",
      titulo: "As palavras espelhadas", nomeFuncao: "contar_palindromos", parametros: ["palavras"],
      sortear: () => ({}),
      f: (p, palavras) => palavras.filter((w) => w === [...w].reverse().join("")).length,
      casos: () => [[[]], [["ovo"]], [["rei", "ovo", "arara"]], [["castelo", "coroa"]], [["osso", "radar", "torre", "reviver"]], [["a", "bb", "abc"]]],
      entrada: (p, r) => [r.embaralhar(["arara", "reviver", "torre", "ovo", "radar", "castelo", "coroa", "osso", "rei", "anilina"]).slice(0, 6)],
      historia: () => "Um palíndromo é uma palavra que se lê igual de trás para a frente. Complete contar_palindromos(palavras) para devolver quantas palavras da lista são palíndromos.",
      dicas: () => [
        "Uma palavra é palíndromo quando é igual à sua versão invertida.",
        "palavra[::-1] devolve a palavra invertida.",
        "Percorra a lista e conte quando palavra == palavra[::-1]."
      ]
    }),
    new ModeloEnigma({
      id: "para-binario", nivel: "dificil", conceito: "Laços e raciocínio algorítmico",
      titulo: "O código das velas", nomeFuncao: "para_binario", parametros: ["n"],
      sortear: () => ({}),
      f: (p, n) => n.toString(2),
      casos: () => [[0], [1], [2], [5], [10], [255]],
      entrada: (p, r) => [r.inteiro(20, 120)],
      historia: () => "As velas do salão representam números em binário: acesa é 1 e apagada é 0. Complete para_binario(n) para devolver o número n (inteiro, n >= 0) escrito em binário, como texto. Exemplo: para_binario(5) devolve '101'. Não use bin().",
      dicas: () => [
        "Divida n por 2 repetidamente: os restos, lidos de trás para a frente, formam o binário.",
        "Trate n == 0 separadamente, devolvendo '0'.",
        "while n > 0: texto = str(n % 2) + texto; n = n // 2"
      ]
    }),
    new ModeloEnigma({
      id: "mdc", nivel: "dificil", conceito: "Algoritmos e laços while",
      titulo: "O maior divisor comum", nomeFuncao: "mdc", parametros: ["a", "b"],
      sortear: () => ({}),
      f: (p, a, b) => { while (b !== 0) [a, b] = [b, a % b]; return a; },
      casos: () => [[12, 8], [7, 13], [100, 75], [21, 14], [48, 18], [5, 5]],
      entrada: (p, r) => { const m = r.inteiro(2, 9); return [m * r.inteiro(2, 9), m * r.inteiro(2, 9)]; },
      historia: () => "Duas engrenagens só se encaixam se os dentes forem divididos pelo maior divisor comum. Complete mdc(a, b) usando o algoritmo de Euclides: enquanto b não for zero, troque (a, b) por (b, a % b); no fim, a é a resposta.",
      dicas: () => [
        "O algoritmo repete a mesma troca até o segundo número chegar a zero.",
        "while b != 0: troque a por b e b pelo resto da divisão de a por b.",
        "while b != 0: a, b = b, a % b   e depois return a"
      ]
    }),
    new ModeloEnigma({
      id: "pares-com-soma", nivel: "dificil", conceito: "Laços aninhados",
      titulo: "Os pares da balança", nomeFuncao: "contar_pares", parametros: ["numeros", "alvo"],
      sortear: () => ({}),
      f: (p, ns, alvo) => { let c = 0; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) if (ns[i] + ns[j] === alvo) c++; return c; },
      casos: () => [[[1, 2, 3, 4], 5], [[], 3], [[2, 2, 2], 4], [[1, 5, 7], 20], [[3, 3, 3, 3], 6], [[1, 9, 5, 5, 4, 6], 10]],
      entrada: (p, r) => [listaAleatoria(r, 7, 1, 12), r.inteiro(8, 14)],
      historia: () => "Dois pesos em pratos opostos equilibram a balança quando somam o valor alvo. Complete contar_pares(numeros, alvo) para devolver em quantos pares de posições diferentes (i < j) a soma dos dois números é igual ao alvo.",
      dicas: () => [
        "Você precisa comparar cada número com todos os que vêm depois dele.",
        "Use dois laços: o externo para i e o interno começando em i + 1.",
        "for i in range(len(numeros)): for j in range(i + 1, len(numeros)): if numeros[i] + numeros[j] == alvo: conte"
      ]
    }),
    new ModeloEnigma({
      id: "maior-subida", nivel: "dificil", conceito: "Laços e raciocínio algorítmico",
      titulo: "A escadaria crescente", nomeFuncao: "maior_subida", parametros: ["numeros"],
      sortear: () => ({}),
      f: (p, ns) => { let melhor = 0, atual = 0; ns.forEach((n, i) => { atual = i > 0 && n > ns[i - 1] ? atual + 1 : 1; melhor = Math.max(melhor, atual); }); return melhor; },
      casos: () => [[[1, 2, 3]], [[3, 2, 1]], [[1, 3, 2, 4, 5, 6]], [[]], [[5]], [[1, 1, 2]]],
      entrada: (p, r) => [listaAleatoria(r, 9, 1, 9)],
      historia: () => "Uma subida é um trecho de números consecutivos da lista em ordem estritamente crescente. Complete maior_subida(numeros) para devolver o tamanho da maior subida (lista vazia devolve 0, e um número sozinho já é uma subida de tamanho 1).",
      dicas: () => [
        "Guarde o tamanho da subida atual e o maior tamanho já visto.",
        "Se o número atual for maior que o anterior, a subida cresce; senão, ela recomeça com tamanho 1.",
        "Atualize o maior depois de cada passo e trate a lista vazia separadamente."
      ]
    })
  ];

  static porId(id) {
    return ModelosEnigma.TODOS.find((m) => m.id === id) || null;
  }

  static doNivel(nivel) {
    return ModelosEnigma.TODOS.filter((m) => m.nivel === nivel);
  }

  // O nível do modelo coincide com o id da dificuldade
  static paraDificuldade(dificuldade) {
    return ModelosEnigma.doNivel(dificuldade);
  }
}
