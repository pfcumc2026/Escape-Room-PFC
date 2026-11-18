// Executa o Python do jogador no navegador (Pyodide em Web Worker) com limite de tempo

export class ExecutorPython {
  static TEMPO_MAXIMO_MS = 6000;
  static TEMPO_CARGA_MS = 90000;

  constructor(urlWorker = new URL("./PyodideWorker.js", import.meta.url)) {
    this.urlWorker = urlWorker;
    this.worker = null;
    this.pronto = null;
    this.proximoId = 1;
  }

  // Inicia o carregamento do Pyodide sem esperar por ele
  preparar() {
    if (this.pronto) return this.pronto;
    this.worker = new Worker(this.urlWorker);
    const worker = this.worker;
    this.pronto = new Promise((resolve, reject) => {
      const limite = setTimeout(() => reject(new Error("O Python demorou demais para carregar.")), ExecutorPython.TEMPO_CARGA_MS);
      const aoMensagem = ({ data }) => {
        if (data.tipo === "pronto") { clearTimeout(limite); worker.removeEventListener("message", aoMensagem); resolve(); }
        if (data.tipo === "falha") { clearTimeout(limite); reject(new Error(data.mensagem)); }
      };
      worker.addEventListener("message", aoMensagem);
      worker.addEventListener("error", (e) => { clearTimeout(limite); reject(new Error(e.message || "Falha ao iniciar o Python.")); });
    });
    this.pronto.catch(() => this.#descartar());
    return this.pronto;
  }

  #descartar() {
    if (this.worker) this.worker.terminate();
    this.worker = null;
    this.pronto = null;
  }

  // modo: "executar" roda só o código; "validar" também aplica os testes
  async executar({ codigo, nomeFuncao, testes = [], entrada = [], modo = "validar" }) {
    try {
      await this.preparar();
    } catch (e) {
      return { fase: "interno", mensagem: e.message };
    }

    const worker = this.worker;
    const id = this.proximoId++;
    return new Promise((resolve) => {
      const limite = setTimeout(() => {
        worker.removeEventListener("message", aoMensagem);
        this.#descartar();
        resolve({ fase: "tempo_esgotado", mensagem: "" });
      }, ExecutorPython.TEMPO_MAXIMO_MS);

      const aoMensagem = ({ data }) => {
        if (data.tipo !== "resultado" || data.id !== id) return;
        clearTimeout(limite);
        worker.removeEventListener("message", aoMensagem);
        resolve(data.resultado);
      };
      worker.addEventListener("message", aoMensagem);
      worker.postMessage({ id, codigo, nomeFuncao, testes, entrada, modo });
    });
  }
}
