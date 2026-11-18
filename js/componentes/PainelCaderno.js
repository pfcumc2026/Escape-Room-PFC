// Caderno compartilhado: progresso da equipe e pistas já encontradas

import { Cronometro } from "../nucleo/Cronometro.js";
import { EstadoPartida } from "../modelos/EstadoPartida.js";

export class PainelCaderno {
  constructor(elemento) {
    this.elemento = elemento;
    this.elemento.classList.add("sala-caderno");
    this.elemento.innerHTML = `
      <div class="sala-caderno__topo">
        <div>
          <p class="sala-eyebrow">Caderno da equipe</p>
          <div class="sala-tempo" role="timer" aria-label="Tempo restante">--:--</div>
        </div>
        <span class="sala-selo"></span>
      </div>
      <div class="sala-progresso" aria-label="Progresso"></div>
      <p class="sala-progresso__texto"></p>
      <div class="sala-prontos" hidden>
        <h3 class="sala-subtitulo">Prontos para resolver</h3>
        <ul class="sala-caderno__lista sala-caderno__prontos"></ul>
      </div>
      <h3 class="sala-subtitulo">Pistas</h3>
      <ul class="sala-caderno__lista"></ul>`;
    this.tempo = this.elemento.querySelector(".sala-tempo");
    this.selo = this.elemento.querySelector(".sala-selo");
    this.progresso = this.elemento.querySelector(".sala-progresso");
    this.textoProgresso = this.elemento.querySelector(".sala-progresso__texto");
    this.lista = this.elemento.querySelector(".sala-caderno__lista:not(.sala-caderno__prontos)");
    this.blocoProntos = this.elemento.querySelector(".sala-prontos");
    this.prontos = this.elemento.querySelector(".sala-caderno__prontos");
  }

  renderizar(partida, dificuldadeNome) {
    const estado = partida.estado;
    this.selo.textContent = `${dificuldadeNome} · ${estado.jogadores.length}/${EstadoPartida.MAX_JOGADORES} jogadores`;

    this.progresso.textContent = "";
    estado.config.ordem.forEach((chave) => {
      const marca = document.createElement("span");
      marca.className = `sala-progresso__marca${estado.resolvido(chave) ? " sala-progresso__marca--feita" : ""}`;
      this.progresso.appendChild(marca);
    });
    this.textoProgresso.textContent = `${estado.totalResolvidos} de ${estado.totalDeEnigmas} mecanismos ativados`;

    this.#desenharProntos(partida);

    this.lista.textContent = "";
    const pistas = estado.emAndamento || estado.encerrada ? partida.caderno : [];
    if (!pistas.length) {
      const vazio = document.createElement("li");
      vazio.className = "sala-caderno__vazio";
      vazio.textContent = "Nada anotado ainda. Comece examinando livros, quadros, brasões, pergaminhos, bilhetes e estantes: é onde ficam as pistas.";
      this.lista.appendChild(vazio);
      return;
    }
    pistas.forEach((p) => {
      const li = document.createElement("li");
      const nome = document.createElement("strong");
      nome.textContent = p.nome;
      const texto = document.createElement("span");
      texto.textContent = p.texto;
      li.append(nome, texto);
      this.lista.appendChild(li);
    });
  }

  #desenharProntos(partida) {
    const enigmas = partida.enigmasLiberados;
    this.blocoProntos.hidden = !enigmas.length;
    this.prontos.textContent = "";
    enigmas.forEach((e) => {
      const li = document.createElement("li");
      const nome = document.createElement("strong");
      nome.textContent = e.final ? `${e.titulo} · desafio final` : e.titulo;
      const texto = document.createElement("span");
      const objeto = partida.sala.objeto(e.objeto)?.nome || "um mecanismo";
      texto.textContent = `${e.conceito}. Você tem as pistas: o mecanismo é ${objeto}. Ele brilha na sala; clique nele para abrir o editor de Python.`;
      li.append(nome, texto);
      this.prontos.appendChild(li);
    });
  }

  atualizarTempo(ms) {
    this.tempo.textContent = Cronometro.formatar(ms);
    this.tempo.classList.toggle("sala-tempo--urgente", ms < 5 * 60 * 1000);
  }

  esconderTempo() {
    this.tempo.textContent = "--:--";
    this.tempo.classList.remove("sala-tempo--urgente");
  }
}
