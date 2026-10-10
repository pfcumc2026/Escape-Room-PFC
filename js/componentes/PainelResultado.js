// Tela final da partida: desfecho, tempo, enigmas, dicas e pontuação

import { Cronometro } from "../nucleo/Cronometro.js";
import { Dificuldade } from "../modelos/Dificuldade.js";
import { EstadoPartida } from "../modelos/EstadoPartida.js";
import { Pontuacao } from "../modelos/Pontuacao.js";

export class PainelResultado {
  static TITULOS = {
    COMPLETED: ["Sala concluída", "A esfera se abre e a saída se revela. Vocês escaparam!"],
    EXPIRED: ["O tempo acabou", "As velas se apagam antes de a saída se abrir."],
    FAILED: ["Partida encerrada", "A equipe desistiu antes de concluir a sala."]
  };

  static montar(estado, { ehProprietario, aoVoltar, aoNova }) {
    const [titulo, frase] = PainelResultado.TITULOS[estado.status];
    const concluida = estado.status === EstadoPartida.STATUS.CONCLUIDA;
    const pontos = estado.pontos ?? Pontuacao.calcular({
      dificuldade: estado.dificuldade, resolvidos: estado.totalResolvidos, dicas: estado.dicasUsadas,
      tentativas: estado.tentativasFalhas, restanteMs: 0, concluida: false
    });

    const linhas = [
      ["Situação", concluida ? "Concluída" : estado.status === EstadoPartida.STATUS.EXPIRADA ? "Tempo esgotado" : "Desistência"],
      ["Dificuldade", Dificuldade.de(estado.dificuldade).nome],
      ["Tempo usado", Cronometro.formatar(estado.tempoUsadoMs)],
      ["Tempo restante", Cronometro.formatar(concluida ? estado.tempoRestanteFinalMs : 0)],
      ["Enigmas resolvidos", `${estado.totalResolvidos} de ${estado.totalDeEnigmas}`],
      ["Dicas usadas", String(estado.dicasUsadas)],
      ["Tentativas falhas", String(estado.tentativasFalhas)]
    ];

    const no = document.createElement("section");
    no.className = `sala-resultado sala-resultado--${concluida ? "ok" : "falha"}`;
    no.innerHTML = `
      <p class="sala-eyebrow">Resultado</p>
      <h2 class="sala-titulo"></h2>
      <p class="sala-resultado__frase"></p>
      <dl class="sala-resultado__dados"></dl>
      <div class="sala-resultado__pontos"><span>Pontuação final</span><strong></strong></div>
      <div class="sala-resultado__acoes"></div>`;
    no.querySelector(".sala-titulo").textContent = titulo;
    no.querySelector(".sala-resultado__frase").textContent = frase;
    no.querySelector(".sala-resultado__pontos strong").textContent = String(pontos);

    const dl = no.querySelector("dl");
    linhas.forEach(([nome, valor]) => {
      const bloco = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = nome;
      const dd = document.createElement("dd");
      dd.textContent = valor;
      bloco.append(dt, dd);
      dl.appendChild(bloco);
    });

    const acoes = no.querySelector(".sala-resultado__acoes");
    const voltar = document.createElement("button");
    voltar.type = "button";
    voltar.className = "btn btn-outline-secondary btn-sm";
    voltar.textContent = "Voltar ao grupo";
    voltar.addEventListener("click", aoVoltar);
    acoes.appendChild(voltar);
    if (ehProprietario && aoNova) {
      const nova = document.createElement("button");
      nova.type = "button";
      nova.className = "btn btn-primary btn-sm";
      nova.textContent = "Nova partida";
      nova.addEventListener("click", () => aoNova(nova));
      acoes.appendChild(nova);
    }
    return no;
  }
}
