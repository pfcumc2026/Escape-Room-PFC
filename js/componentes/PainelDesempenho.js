const NIVEIS = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };

export class PainelDesempenho {
  #graficos = [];

  constructor(raiz) {
    this.raiz = raiz;
  }

  renderizar(dados) {
    const total = dados.concluidas + dados.emAndamento + Object.values(dados.porDificuldade)
      .reduce((t, n) => t + n.concluidas + n.naoConcluidas, 0);
    this.raiz.querySelector("[data-vazio]").classList.toggle("d-none", total > 0);
    this.raiz.querySelector("[data-graficos]").classList.toggle("d-none", total === 0);

    this.#numero("concluidas", dados.concluidas);
    this.#numero("andamento", dados.emAndamento);
    this.#numero("enigmas", dados.enigmasResolvidos);
    this.#numero("taxa", dados.taxaConclusao === null ? "—" : `${Math.round(dados.taxaConclusao * 100)}%`);
    this.#numero("tempo", PainelDesempenho.formatarTempo(dados.tempoMedioMs));

    if (total > 0 && window.Chart) this.#desenhar(dados);
  }

  falhar() {
    this.raiz.querySelector("[data-erro]").classList.remove("d-none");
  }

  static formatarTempo(ms) {
    if (ms === null) return "—";
    const minutos = Math.floor(ms / 60000);
    const segundos = Math.round((ms % 60000) / 1000);
    return `${minutos}min ${String(segundos).padStart(2, "0")}s`;
  }

  #numero(chave, valor) {
    this.raiz.querySelector(`[data-kpi="${chave}"]`).textContent = valor;
  }

  #desenhar(dados) {
    this.#graficos.forEach((g) => g.destroy());
    const css = getComputedStyle(document.documentElement);
    const cor = (nome) => css.getPropertyValue(nome).trim();
    const eixos = {
      x: { ticks: { color: cor("--ph-muted") }, grid: { display: false }, stacked: true },
      y: { ticks: { color: cor("--ph-muted"), precision: 0 }, grid: { color: cor("--ph-line") }, beginAtZero: true, stacked: true }
    };
    const opcoes = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: cor("--ph-text") } } }, scales: eixos };

    const semanas = new Chart(this.raiz.querySelector("[data-grafico='semanas']"), {
      type: "bar",
      data: {
        labels: dados.porSemana.map((s) => s.inicio.slice(8) + "/" + s.inicio.slice(5, 7)),
        datasets: [{ label: "Partidas concluídas", data: dados.porSemana.map((s) => s.concluidas), backgroundColor: cor("--ph-blue") }]
      },
      options: { ...opcoes, plugins: { ...opcoes.plugins, legend: { display: false } } }
    });

    const niveis = Object.keys(NIVEIS);
    const dificuldade = new Chart(this.raiz.querySelector("[data-grafico='dificuldade']"), {
      type: "bar",
      data: {
        labels: niveis.map((n) => NIVEIS[n]),
        datasets: [
          { label: "Concluídas", data: niveis.map((n) => dados.porDificuldade[n].concluidas), backgroundColor: cor("--ph-ok") },
          { label: "Não concluídas", data: niveis.map((n) => dados.porDificuldade[n].naoConcluidas), backgroundColor: cor("--ph-danger") }
        ]
      },
      options: opcoes
    });
    this.#graficos = [semanas, dificuldade];
  }
}
