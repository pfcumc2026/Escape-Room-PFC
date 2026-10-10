// Resultado de uma execução do código do jogador, já com o feedback educativo

export class TentativaEnigma {
  constructor({ fase, resolvida = false, penaliza = false, titulo, detalhes = [], saida = "" }) {
    this.fase = fase;
    this.resolvida = resolvida;
    this.penaliza = penaliza;
    this.titulo = titulo;
    this.detalhes = detalhes;
    this.saida = saida;
  }

  static deExecucao(r) {
    const saida = r.saida || "";
    const linha = r.linha ? ` (linha ${r.linha})` : "";
    switch (r.fase) {
      case "executado":
        return new TentativaEnigma({ fase: r.fase, titulo: "Código executado.", saida });
      case "sintaxe":
        return new TentativaEnigma({
          fase: r.fase, penaliza: true, saida,
          titulo: `Erro de sintaxe${linha}: ${r.mensagem}.`,
          detalhes: ["Confira os dois-pontos, os parênteses e a indentação."]
        });
      case "execucao":
        return new TentativaEnigma({
          fase: r.fase, penaliza: true, saida,
          titulo: `Seu código gerou um erro ao executar${linha}.`,
          detalhes: [r.mensagem]
        });
      case "funcao_ausente":
        return new TentativaEnigma({
          fase: r.fase, penaliza: true, saida,
          titulo: `Não encontrei a função ${r.mensagem}.`,
          detalhes: ["Defina-a com def e mantenha o nome exatamente como no modelo."]
        });
      case "tempo_esgotado":
        return new TentativaEnigma({
          fase: r.fase, penaliza: true,
          titulo: "O código demorou demais para terminar.",
          detalhes: ["Verifique se existe um laço que nunca acaba."]
        });
      case "teste":
        return TentativaEnigma.#deTestes(r);
      case "ok":
        return new TentativaEnigma({ fase: r.fase, titulo: "Todos os testes passaram.", saida });
      default:
        return new TentativaEnigma({ fase: "interno", titulo: "Não foi possível executar o Python agora.", detalhes: [r.mensagem || ""] });
    }
  }

  static #deTestes(r) {
    const visiveis = r.falhas.filter((f) => f.visivel).slice(0, 3);
    const ocultas = r.falhas.length - r.falhas.filter((f) => f.visivel).length;
    const detalhes = visiveis.map((f) => TentativaEnigma.#descreverFalha(f));
    if (ocultas > 0) detalhes.push(`${ocultas === 1 ? "Um teste oculto também falhou" : `${ocultas} testes ocultos também falharam`}: teste casos extremos, como zero e valores negativos.`);
    return new TentativaEnigma({
      fase: "teste", penaliza: true, saida: r.saida || "",
      titulo: `Sua função executou, mas ${r.falhas.length} de ${r.total} testes falharam.`,
      detalhes
    });
  }

  static #descreverFalha(f) {
    const entrada = `Com a entrada (${f.args})`;
    switch (f.tipo) {
      case "erro": return `${entrada}, ocorreu um erro: ${f.obtido}${f.linha ? ` (linha ${f.linha})` : ""}.`;
      case "sem_retorno": return `${entrada}, a função devolveu None. Faltou um return com o valor?`;
      case "tipo": return `${entrada}, o resultado deveria ser ${f.tipo_esperado}, mas foi ${f.tipo_obtido}.`;
      default: return `${entrada}, era esperado ${f.esperado}, mas a função devolveu ${f.obtido}.`;
    }
  }

  // Combina os testes aprovados com o código digitado para abrir o mecanismo
  static conferirCodigo(tentativa, codigoDigitado, codigoEsperado) {
    if (tentativa.fase !== "ok") return tentativa;
    const digitado = String(codigoDigitado || "").trim().replace(/^(['"])(.*)\1$/, "$2");
    if (!digitado) {
      return new TentativaEnigma({
        fase: "ok", saida: tentativa.saida,
        titulo: "Todos os testes passaram!",
        detalhes: ["Agora use sua função com os valores da pista e digite o código do mecanismo."]
      });
    }
    if (digitado !== codigoEsperado) {
      return new TentativaEnigma({
        fase: "codigo", penaliza: true, saida: tentativa.saida,
        titulo: "Os testes passaram, mas o código digitado não abre o mecanismo.",
        detalhes: ["Confira os valores encontrados nas pistas e o resultado da sua função com eles."]
      });
    }
    return new TentativaEnigma({ fase: "resolvido", resolvida: true, saida: tentativa.saida, titulo: "O mecanismo cede. Enigma resolvido!" });
  }
}
