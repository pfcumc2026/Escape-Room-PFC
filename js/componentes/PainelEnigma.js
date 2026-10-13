// Painel de um enigma: história, pistas, editor de Python, dicas e feedback

import { Dialogo } from "./Dialogo.js";
import { Pontuacao } from "../modelos/Pontuacao.js";

export class PainelEnigma extends Dialogo {
  constructor(raiz) {
    super(raiz);
    this.contexto = null;
  }

  // contexto: { enigma, pistas, contador, maxDicas, aoExecutar, aoValidar, aoDica, aoFechar }
  mostrar(contexto) {
    this.contexto = contexto;
    const { enigma, pistas, contador } = contexto;
    const no = document.createElement("div");
    no.className = "sala-enigma";
    no.innerHTML = `
      <header class="sala-enigma__topo">
        <div>
          <p class="sala-eyebrow"></p>
          <h2 class="sala-titulo"></h2>
        </div>
        <button type="button" class="sala-fechar" aria-label="Fechar">&times;</button>
      </header>
      <p class="sala-enigma__historia"></p>
      <section class="sala-enigma__pistas" aria-label="Pistas coletadas">
        <h3 class="sala-subtitulo">Pistas no caderno</h3>
        <ul></ul>
      </section>
      <label class="sala-subtitulo" for="sala-codigo-py">Seu código Python</label>
      <textarea id="sala-codigo-py" class="sala-editor" spellcheck="false" autocapitalize="off" autocomplete="off" rows="10"></textarea>
      <div class="sala-enigma__acoes">
        <label class="sala-enigma__codigo">
          <span class="sala-subtitulo">Código do mecanismo</span>
          <input type="text" class="form-control form-control-sm ph-mono" maxlength="60" autocomplete="off" placeholder="resultado da sua função com a pista">
        </label>
        <div class="sala-enigma__botoes">
          <button type="button" class="btn btn-outline-secondary btn-sm" data-acao="executar">Executar</button>
          <button type="button" class="btn btn-primary btn-sm" data-acao="validar">Testar e abrir</button>
        </div>
      </div>
      <div class="sala-console" aria-label="Console">
        <div class="sala-console__topo">Console</div>
        <pre class="sala-console__texto" role="log" aria-live="polite"></pre>
      </div>
      <div class="sala-feedback" role="status" aria-live="polite" hidden></div>
      <div class="sala-enigma__dicas">
        <button type="button" class="btn btn-outline-secondary btn-sm" data-acao="dica"></button>
        <ol class="sala-enigma__lista-dicas"></ol>
      </div>`;

    no.querySelector(".sala-eyebrow").textContent = `${enigma.final ? "Desafio final" : "Enigma"} · ${enigma.conceito}`;
    no.querySelector(".sala-titulo").textContent = enigma.titulo;
    no.querySelector(".sala-enigma__historia").textContent = enigma.historia;
    const listaPistas = no.querySelector(".sala-enigma__pistas ul");
    pistas.forEach((t) => {
      const li = document.createElement("li");
      li.textContent = t;
      listaPistas.appendChild(li);
    });

    this.editor = no.querySelector(".sala-editor");
    this.codigo = no.querySelector(".sala-enigma__codigo input");
    this.feedback = no.querySelector(".sala-feedback");
    this.console = no.querySelector(".sala-console__texto");
    this.#escreverConsole("Clique em Executar para ver o resultado do seu código.\nUse print(...) ou escreva uma expressão na última linha, como area_livre(3, 4).", "dica");
    this.botaoExecutar = no.querySelector('[data-acao="executar"]');
    this.botaoValidar = no.querySelector('[data-acao="validar"]');
    this.botaoDica = no.querySelector('[data-acao="dica"]');
    this.listaDicas = no.querySelector(".sala-enigma__lista-dicas");

    this.editor.value = contador.rascunho;
    this.codigo.value = contador.codigo;
    this.editor.addEventListener("input", () => { contador.rascunho = this.editor.value; });
    this.codigo.addEventListener("input", () => { contador.codigo = this.codigo.value; });
    this.editor.addEventListener("keydown", (ev) => this.#tratarTecla(ev));
    no.querySelector(".sala-fechar").addEventListener("click", () => this.fechar());
    this.botaoExecutar.addEventListener("click", () => this.#executar());
    this.botaoValidar.addEventListener("click", () => this.#validar());
    this.botaoDica.addEventListener("click", () => this.#pedirDica());

    for (let i = 0; i < contador.dicas; i++) this.#exibirDica(enigma.dicas[i], i);
    this.#atualizarBotaoDica();

    this.abrir(no, { largo: true, rotulo: enigma.titulo, aoFechar: contexto.aoFechar });
    this.editor.focus();
  }

  #tratarTecla(ev) {
    if (ev.key === "Tab") {
      ev.preventDefault();
      const { selectionStart: ini, selectionEnd: fim, value } = this.editor;
      this.editor.value = `${value.slice(0, ini)}    ${value.slice(fim)}`;
      this.editor.selectionStart = this.editor.selectionEnd = ini + 4;
      this.editor.dispatchEvent(new Event("input"));
    }
    if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); this.#validar(); }
  }

  #ocupar(ocupado, texto = "") {
    [this.botaoExecutar, this.botaoValidar, this.botaoDica].forEach((b) => { b.disabled = ocupado; });
    if (ocupado) this.#exibirFeedback({ titulo: texto, detalhes: [], saida: "" }, "neutro");
  }

  async #executar() {
    this.#ocupar(true, "Executando… na primeira vez o Python leva alguns segundos para carregar.");
    const tentativa = await this.contexto.aoExecutar(this.editor.value);
    this.#ocupar(false);
    this.#mostrarNoConsole(tentativa);
    this.#exibirFeedback({ ...tentativa, saida: "" }, tentativa.fase === "executado" ? "neutro" : "erro");
  }

  async #validar() {
    this.#ocupar(true, "Validando… na primeira vez o Python leva alguns segundos para carregar.");
    let tentativa;
    try {
      tentativa = await this.contexto.aoValidar(this.editor.value, this.codigo.value);
    } catch (e) {
      this.#ocupar(false);
      this.#exibirFeedback({ titulo: "Não foi possível registrar sua resposta.", detalhes: [e.message || ""], saida: "" }, "erro");
      return;
    }
    this.#ocupar(false);
    this.#mostrarNoConsole(tentativa);
    const tom = tentativa.resolvida ? "ok" : tentativa.fase === "ok" ? "neutro" : "erro";
    this.#exibirFeedback({ ...tentativa, saida: "" }, tom);
    if (tentativa.resolvida) {
      [this.botaoExecutar, this.botaoValidar, this.botaoDica].forEach((b) => { b.disabled = true; });
    }
  }

  #pedirDica() {
    const texto = this.contexto.aoDica();
    if (!texto) return;
    this.#exibirDica(texto, this.contexto.contador.dicas - 1);
    this.#atualizarBotaoDica();
  }

  // A saída do código (print e valor da última expressão) vai para o console; erros aparecem em vermelho
  #mostrarNoConsole(tentativa) {
    const erro = ["sintaxe", "execucao", "tempo_esgotado"].includes(tentativa.fase)
      ? [tentativa.titulo, ...tentativa.detalhes].join("\n")
      : "";
    const saida = tentativa.saida.trimEnd();
    if (erro) this.#escreverConsole(saida ? `${saida}\n${erro}` : erro, "erro");
    else this.#escreverConsole(saida || "(o código rodou sem imprimir nada)", saida ? "saida" : "dica");
  }

  #escreverConsole(texto, tipo) {
    this.console.textContent = texto;
    this.console.className = `sala-console__texto sala-console__texto--${tipo}`;
    this.console.scrollIntoView({ block: "nearest" });
  }

  #exibirDica(texto, indice) {
    const li = document.createElement("li");
    li.textContent = texto;
    li.dataset.indice = String(indice + 1);
    this.listaDicas.appendChild(li);
  }

  #atualizarBotaoDica() {
    const { dicas } = this.contexto.contador;
    const max = this.contexto.maxDicas;
    this.botaoDica.textContent = dicas >= max ? "Sem mais dicas" : `Pedir dica (${dicas}/${max}) · −${Pontuacao.PENALIDADE_DICA} pts`;
    this.botaoDica.disabled = dicas >= max;
  }

  #exibirFeedback(tentativa, tom) {
    this.feedback.hidden = false;
    this.feedback.className = `sala-feedback sala-feedback--${tom}`;
    this.feedback.textContent = "";
    const t = document.createElement("strong");
    t.textContent = tentativa.titulo;
    this.feedback.appendChild(t);
    tentativa.detalhes.forEach((d) => {
      const p = document.createElement("p");
      p.textContent = d;
      this.feedback.appendChild(p);
    });
    if (tentativa.saida) {
      const pre = document.createElement("pre");
      pre.className = "sala-saida";
      pre.textContent = tentativa.saida;
      this.feedback.appendChild(pre);
    }
    this.feedback.scrollIntoView({ block: "nearest" });
  }

  // Outro jogador resolveu enquanto este painel estava aberto
  resolvidoPorOutro(nome) {
    this.#exibirFeedback({ titulo: `${nome} acabou de resolver este enigma.`, detalhes: [], saida: "" }, "ok");
    [this.botaoExecutar, this.botaoValidar, this.botaoDica].forEach((b) => { b.disabled = true; });
  }
}
