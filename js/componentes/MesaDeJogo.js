// Liga a Partida à tela: sala explorável, caderno, textos de inspeção e painel de enigma

import { VisaoSala } from "./VisaoSala.js";
import { PainelCaderno } from "./PainelCaderno.js";
import { PainelEnigma } from "./PainelEnigma.js";
import { Dialogo } from "./Dialogo.js";
import { Dificuldade } from "../modelos/Dificuldade.js";
import { notificador } from "../nucleo/Notificador.js";
import { Partida } from "../servicos/Partida.js";

export class MesaDeJogo {
  constructor({ palco, caderno, partida, renderInicial = null }) {
    this.partida = partida;
    this.renderInicial = renderInicial;
    this.visao = new VisaoSala(palco, {
      aoEscolher: (h) => this.#interagir(h),
      aoTrocar: () => this.#desenharHotspots()
    });
    this.caderno = new PainelCaderno(caderno);
    this.dialogo = new Dialogo();
    this.painel = new PainelEnigma();
    this.chaveAberta = null;
    this.vistos = { achadas: new Set(), resolvidas: new Set() };
    this.ocupado = false;
    this.jaAvisou = false;
  }

  iniciar() {
    this.visao.definirSala(this.partida.sala, this.renderInicial);
    this.cancelar = this.partida.assinar((estado) => this.#aoMudar(estado));
    this.relogio = setInterval(() => this.#tique(), 500);
    if (this.partida.estado) this.#aoMudar(this.partida.estado);
    this.#apresentar();
  }

  // Explica o objetivo na primeira vez que o jogador entra na sala
  #apresentar() {
    const estado = this.partida.estado;
    if (!estado?.emAndamento || !this.partida.participa || Object.keys(estado.achadas).length) return;
    this.dialogo.abrir(Dialogo.texto({
      eyebrow: "Como jogar",
      titulo: "Fuja do estúdio",
      paragrafos: [
        "Ande clicando nas setas sobre a imagem (ou com as setas do teclado). O botão Mapa mostra onde você está e leva direto a outro ponto.",
        "Clique nos objetos para se aproximar e examiná-los. Cada pista encontrada vai para o caderno da equipe.",
        "Com as pistas de um enigma, procure o mecanismo correspondente: cadeados, baús, engrenagens, teclas. Ele abre o editor de Python.",
        "Escreva a função, use Testar e abrir e digite o código do mecanismo. Resolvam todos e abram a esfera de cristal antes do tempo acabar."
      ],
      rotuloBotao: "Começar",
      aoFechar: () => this.dialogo.fechar()
    }), { rotulo: "Como jogar" });
  }

  destruir() {
    if (this.cancelar) this.cancelar();
    clearInterval(this.relogio);
    this.visao.destruir();
    this.dialogo.destruir();
    this.painel.destruir();
  }

  #tique() {
    if (this.partida.estado?.emAndamento) this.caderno.atualizarTempo(this.partida.restanteMs);
    else this.caderno.esconderTempo();
  }

  #aoMudar(estado) {
    if (!estado) return;
    this.caderno.renderizar(this.partida, Dificuldade.de(estado.dificuldade).nome);
    this.#desenharHotspots();
    this.#tique();
    this.#avisarProgressoDosOutros(estado);

    if (estado.encerrada) {
      this.dialogo.fechar();
      this.painel.fechar();
      return;
    }
    if (this.chaveAberta && estado.resolvido(this.chaveAberta)) {
      const autor = estado.resolvidas[this.chaveAberta].by;
      if (autor !== this.partida.uid) this.painel.resolvidoPorOutro("Um colega");
    }
  }

  #desenharHotspots() {
    if (!this.visao.renderId) return;
    const prontos = new Set(this.partida.enigmasLiberados.map((e) => e.objeto));
    this.visao.desenhar(this.partida.hotspotsVisiveis(this.visao.renderId), prontos);
  }

  #avisarProgressoDosOutros(estado) {
    const primeira = !this.jaAvisou;
    Object.entries(estado.achadas).forEach(([id, dados]) => {
      if (this.vistos.achadas.has(id)) return;
      this.vistos.achadas.add(id);
      if (!primeira && dados.by !== this.partida.uid) notificador.info("Um colega encontrou uma nova pista. Confira o caderno.");
    });
    Object.entries(estado.resolvidas).forEach(([chave, dados]) => {
      if (this.vistos.resolvidas.has(chave)) return;
      this.vistos.resolvidas.add(chave);
      if (!primeira && dados.by !== this.partida.uid) notificador.sucesso("Um colega ativou um mecanismo!");
    });
    this.jaAvisou = true;
  }

  async #interagir(hotspot) {
    if (this.ocupado) return;
    this.ocupado = true;
    try {
      const r = await this.partida.interagir(hotspot);
      if (r.tipo === "enigma") this.#abrirEnigma(r);
      else this.#abrirTexto(r);
    } catch (e) {
      notificador.falha(e, "Não foi possível examinar este objeto.");
    }
    this.ocupado = false;
  }

  #abrirTexto(r) {
    const paragrafos = r.tipo === "pista" ? [r.descricao, r.texto, r.nova ? "Anotado no caderno da equipe." : "Já está no caderno."] : [r.texto];
    this.dialogo.abrir(Dialogo.texto({
      titulo: r.titulo,
      eyebrow: r.tipo === "pista" ? "Pista encontrada" : "Você examina",
      paragrafos: paragrafos.filter(Boolean),
      aoFechar: () => this.dialogo.fechar()
    }), { rotulo: r.titulo });
  }

  #abrirEnigma({ enigma, pistas }) {
    this.chaveAberta = enigma.chave;
    const contador = this.partida.contador(enigma.chave, enigma.codigoInicial);
    this.partida.preparar();
    this.painel.mostrar({
      enigma, pistas, contador, maxDicas: Partida.MAX_DICAS,
      aoExecutar: (codigo) => this.partida.executar(enigma.chave, codigo),
      aoValidar: (codigo, digitado) => this.partida.validar(enigma.chave, codigo, digitado),
      aoDica: () => this.partida.usarDica(enigma.chave),
      aoFechar: () => { this.chaveAberta = null; }
    });
  }
}
