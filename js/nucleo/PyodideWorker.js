// Worker clássico: o Pyodide roda fora da thread principal para que laços infinitos possam ser interrompidos

importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

const HARNESS = `
import ast, json, io, contextlib

def _normalizar(v):
    if isinstance(v, tuple):
        v = list(v)
    if isinstance(v, list):
        return [_normalizar(x) for x in v]
    return v

def _linha(exc):
    tb = exc.__traceback__
    linha = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == "<seu_codigo>":
            linha = tb.tb_lineno
        tb = tb.tb_next
    return linha

def rodar(codigo, nome, testes_json, entrada_json, modo):
    saida = io.StringIO()
    res = {"fase": "ok", "mensagem": "", "linha": None, "saida": "", "falhas": [], "codigo": None, "aprovados": 0, "total": 0}

    def encerrar():
        res["saida"] = saida.getvalue()[:2000]
        return json.dumps(res)

    # Como num REPL: se a última linha for uma expressão, o valor dela é impresso
    try:
        arvore = ast.parse(codigo, "<seu_codigo>")
        ultima = None
        if arvore.body and isinstance(arvore.body[-1], ast.Expr):
            ultima = compile(ast.Expression(arvore.body[-1].value), "<seu_codigo>", "eval")
            arvore.body = arvore.body[:-1]
        compilado = compile(arvore, "<seu_codigo>", "exec")
    except SyntaxError as e:
        res.update(fase="sintaxe", mensagem=str(e.msg), linha=e.lineno)
        return encerrar()

    ns = {"__name__": "__main__"}
    with contextlib.redirect_stdout(saida):
        try:
            exec(compilado, ns)
            if ultima is not None:
                valor = eval(ultima, ns)
                if valor is not None:
                    print(repr(valor))
        except Exception as e:
            res.update(fase="execucao", mensagem=type(e).__name__ + ": " + str(e), linha=_linha(e))
            return encerrar()

        if modo == "executar":
            res["fase"] = "executado"
            return encerrar()

        funcao = ns.get(nome)
        if not callable(funcao):
            res.update(fase="funcao_ausente", mensagem=nome)
            return encerrar()

        testes = json.loads(testes_json)
        res["total"] = len(testes)
        for t in testes:
            esperado = t["esperado"]
            args = t["args"]
            falha = {"args": repr(args)[1:-1], "visivel": t["visivel"], "esperado": repr(esperado)}
            try:
                obtido = _normalizar(funcao(*json.loads(json.dumps(args))))
            except Exception as e:
                falha.update(tipo="erro", obtido=type(e).__name__ + ": " + str(e), linha=_linha(e))
                res["falhas"].append(falha)
                continue
            falha["obtido"] = repr(obtido)
            if obtido is None and esperado is not None:
                falha["tipo"] = "sem_retorno"
            elif type(obtido) is not type(esperado):
                falha["tipo"] = "tipo"
                falha["tipo_obtido"] = type(obtido).__name__
                falha["tipo_esperado"] = type(esperado).__name__
            elif obtido != esperado:
                falha["tipo"] = "valor"
            else:
                res["aprovados"] += 1
                continue
            res["falhas"].append(falha)

        if res["falhas"]:
            res["fase"] = "teste"
            return encerrar()

        try:
            res["codigo"] = str(funcao(*json.loads(entrada_json)))
        except Exception as e:
            res.update(fase="execucao", mensagem=type(e).__name__ + ": " + str(e), linha=_linha(e))
    return encerrar()
`;

const pronto = (async () => {
  const py = await loadPyodide();
  py.runPython(HARNESS);
  return py;
})();

pronto.then(() => self.postMessage({ tipo: "pronto" }), (e) => self.postMessage({ tipo: "falha", mensagem: String(e) }));

self.onmessage = async ({ data }) => {
  try {
    const py = await pronto;
    const rodar = py.globals.get("rodar");
    const json = rodar(data.codigo, data.nomeFuncao, JSON.stringify(data.testes || []), JSON.stringify(data.entrada || []), data.modo);
    rodar.destroy();
    self.postMessage({ tipo: "resultado", id: data.id, resultado: JSON.parse(json) });
  } catch (e) {
    self.postMessage({ tipo: "resultado", id: data.id, resultado: { fase: "interno", mensagem: String(e) } });
  }
};
