// Sessão de jogo: regras da partida, independente da tela e do meio de persistência

import { EstadoPartida } from "../modelos/EstadoPartida.js";
import { Enigma } from "../modelos/Enigma.js";
import { Pista } from "../modelos/Pista.js";
import { Pontuacao } from "../modelos/Pontuacao.js";
import { Dificuldade } from "../modelos/Dificuldade.js";
import { Cronometro } from "../nucleo/Cronometro.js";
import { Aleatorio } from "../nucleo/Aleatorio.js";
import { GeradorProcedural } from "../nucleo/GeradorProcedural.js";
import { ErroApp } from "../nucleo/ErroApp.js";
import { GerenciadorEnigmas } from "./GerenciadorEnigmas.js";

export class Partida {
  static MAX_DICAS = 3;

  constructor({ gid, sala, servico, uid, gerenciador = new GerenciadorEnigmas() }) {
    this.gid = gid;
    this.sala = sala;
    this.servico = servico;
    this.uid = uid;
    this.gerenciador = gerenciador;

    this.estado = null;
    this.enigmas = new Map();
    this.cronometro = null;
    this.deslocamentoMs = 0;
    this.contadores = new Map();
    this.ouvintes = new Set();
    this.cancelarObservacao = null;
    this.expiracaoEnviada = false;
  }

  async observar(aoFalhar = () => {}) {
    this.deslocamentoMs = await this.servico.deslocamentoMs();
    this.cancelarObservacao = this.servico.observar(this.gid, (estado) => this.#aplicar(estado), aoFalhar);
  }

  destruir() {
    if (this.cancelarObservacao) this.cancelarObservacao();
    if (this.cronometro) this.cronometro.parar();
    this.ouvintes.clear();
  }

  assinar(ouvinte) {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }

  #notificar() {
    this.ouvintes.forEach((o) => o(this.estado));
  }

  #aplicar(estado) {
    this.estado = estado;
    if (estado) {
      this.#montarEnigmas(estado);
      this.#sincronizarCronometro(estado);
    }
    this.#notificar();
  }

  #montarEnigmas(estado) {
    if (this.enigmas.size === estado.totalDeEnigmas && this.semente === estado.semente) return;
    this.semente = estado.semente;
    this.enigmas.clear();
    estado.config.ordem.forEach((chave) => {
      const e = estado.config.enigmas[chave];
      this.enigmas.set(chave, Enigma.criar({
        chave, modeloId: e.modeloId, variante: e.variante, dificuldade: estado.dificuldade, final: !!e.final, objeto: e.objeto
      }));
    });
  }

  #sincronizarCronometro(estado) {
    if (estado.emAndamento && estado.expiraEm && !this.cronometro) {
      this.cronometro = new Cronometro({ expiraEm: estado.expiraEm, deslocamentoMs: this.deslocamentoMs });
      this.cronometro.iniciar(() => {}, () => this.#expirar());
    }
    if (!estado.emAndamento && this.cronometro) {
      this.cronometro.parar();
      this.cronometro = null;
    }
  }

  async #expirar() {
    if (this.expiracaoEnviada || !this.estado?.emAndamento) return;
    this.expiracaoEnviada = true;
    try {
      await this.servico.encerrar(this.gid, EstadoPartida.STATUS.EXPIRADA);
    } catch {
      this.expiracaoEnviada = false;
    }
  }

  get restanteMs() {
    return this.cronometro ? this.cronometro.restanteMs() : 0;
  }

  get ehProprietario() {
    return !!this.estado && this.estado.ownerId === this.uid;
  }

  get participa() {
    return !!this.estado && this.estado.participa(this.uid);
  }

  // Ciclo de vida

  async criar(dificuldade) {
    if (!Dificuldade.valida(dificuldade)) throw new ErroApp("Escolha uma dificuldade.");
    const semente = Aleatorio.novaSemente();
    const { config } = GeradorProcedural.gerar({ sala: this.sala, dificuldade, semente });
    await this.servico.criar(this.gid, { uid: this.uid, dificuldade, semente, config });
  }

  async entrar() {
    if (!this.estado?.emEspera) throw new ErroApp("A partida já começou.");
    if (this.estado.lotada) throw new ErroApp("A partida já tem 3 jogadores.");
    await this.servico.entrar(this.gid, this.uid);
  }

  async iniciar() {
    if (!EstadoPartida.transicaoValida(this.estado.status, EstadoPartida.STATUS.JOGANDO)) throw new ErroApp("A partida já foi iniciada.");
    await this.servico.iniciar(this.gid, this.estado.dificuldade, this.deslocamentoMs);
  }

  async desistir() {
    if (!EstadoPartida.transicaoValida(this.estado.status, EstadoPartida.STATUS.FALHOU)) return;
    await this.servico.encerrar(this.gid, EstadoPartida.STATUS.FALHOU);
  }

  async reiniciar() {
    await this.servico.reiniciar(this.gid);
    this.enigmas.clear();
    this.contadores.clear();
    this.expiracaoEnviada = false;
  }

  // Exploração

  hotspotsVisiveis(renderId) {
    if (!this.estado?.emAndamento) return [];
    return this.sala.hotspotsDoRender(renderId).filter((h) => {
      const objeto = this.sala.objeto(h.objectId);
      return !(objeto.estadoInicial === "hidden" && !this.estado.objetoLiberado(objeto));
    });
  }

  enigmaDoObjeto(objetoId) {
    return [...this.enigmas.values()].find((e) => e.objeto === objetoId) || null;
  }

  // Textos das pistas já encontradas para um enigma, na ordem das peças
  pecasEncontradas(chave) {
    const ids = this.estado.config.enigmas[chave].pistas;
    const enigma = this.enigmas.get(chave);
    const pecas = enigma.pecas(ids.length);
    return ids.map((id, i) => (this.estado.pistaEncontrada(id)
      ? { objetoId: id, texto: Pista.texto(this.sala.objeto(id)?.clueId, pecas[i]) }
      : null));
  }

  get caderno() {
    return this.estado.config.ordem.flatMap((chave) => this.pecasEncontradas(chave)
      .filter(Boolean)
      .map((p) => ({ chave, nome: this.sala.objeto(p.objetoId)?.nome || p.objetoId, texto: p.texto })));
  }

  // Enigmas com todas as pistas encontradas e ainda não resolvidos (o final só depois dos demais)
  get enigmasLiberados() {
    const e = this.estado;
    if (!e?.emAndamento) return [];
    return e.config.ordem
      .filter((k) => !e.resolvido(k) && e.config.enigmas[k].pistas.every((o) => e.pistaEncontrada(o)))
      .filter((k) => !e.config.enigmas[k].final || e.config.ordem.every((o) => o === k || e.resolvido(o)))
      .map((k) => this.enigmas.get(k));
  }

  // Retorna o que a tela deve mostrar ao interagir com um hotspot
  async interagir(hotspot) {
    const objeto = this.sala.objeto(hotspot.objectId);
    const titulo = objeto.nome;
    const texto = (t) => ({ tipo: "texto", titulo, texto: t });

    if (!this.estado?.emAndamento) return texto("A partida não está em andamento.");
    if (!this.participa) return texto("Você está apenas observando esta partida.");

    const bloqueio = this.estado.motivoDeBloqueio(objeto);
    if (bloqueio) return texto(bloqueio);

    const pista = this.estado.config.pistas[objeto.id];
    if (pista) return this.#lerPista(objeto, pista);

    const enigma = this.enigmaDoObjeto(objeto.id);
    if (!enigma) return texto(objeto.descricao || "Nada de especial por aqui.");
    if (this.estado.resolvido(enigma.chave)) return texto("Este mecanismo já foi resolvido.");

    if (enigma.final) {
      const pendentes = this.estado.config.ordem.filter((k) => k !== enigma.chave && !this.estado.resolvido(k));
      if (pendentes.length) return texto("A esfera permanece inerte. Ainda há mecanismos adormecidos pela sala.");
    }
    const pecas = this.pecasEncontradas(enigma.chave);
    if (pecas.some((p) => p === null)) return texto("Parece um mecanismo, mas você ainda não sabe operá-lo. Procure pistas em livros, quadros, brasões e bilhetes.");
    return { tipo: "enigma", titulo, enigma, pistas: pecas.map((p) => p.texto) };
  }

  async #lerPista(objeto, pista) {
    const enigma = this.enigmas.get(pista.enigma);
    const pecas = enigma.pecas(this.estado.config.enigmas[pista.enigma].pistas.length);
    const texto = Pista.texto(objeto.clueId, pecas[pista.indice]);
    const nova = !this.estado.pistaEncontrada(objeto.id);
    if (nova) await this.servico.registrarPista(this.gid, objeto.id, this.uid);
    return { tipo: "pista", titulo: objeto.nome, descricao: objeto.descricao, texto, nova };
  }

  // Enigmas

  contador(chave, codigoInicial = "") {
    if (!this.contadores.has(chave)) this.contadores.set(chave, { dicas: 0, tentativas: 0, rascunho: codigoInicial, codigo: "" });
    return this.contadores.get(chave);
  }

  usarDica(chave) {
    const c = this.contador(chave);
    if (c.dicas >= Partida.MAX_DICAS) return null;
    c.dicas++;
    return this.enigmas.get(chave).dicas[c.dicas - 1];
  }

  async executar(chave, codigo) {
    return this.gerenciador.executar(this.enigmas.get(chave), codigo);
  }

  // Valida o código e, se aprovado, registra a resolução e eventualmente a conclusão da partida
  async validar(chave, codigo, codigoDigitado) {
    const enigma = this.enigmas.get(chave);
    const c = this.contador(chave);
    const tentativa = await this.gerenciador.validar(enigma, codigo, codigoDigitado);

    if (tentativa.penaliza) c.tentativas++;
    if (!tentativa.resolvida) return tentativa;
    if (!this.estado.emAndamento) return tentativa;

    const dados = { uid: this.uid, dicas: c.dicas, tentativas: c.tentativas };
    const restantes = this.estado.config.ordem.filter((k) => k !== chave && !this.estado.resolvido(k));
    try {
      if (enigma.final && !restantes.length) await this.servico.concluir(this.gid, chave, dados, this.#pontuacaoFinal(dados));
      else await this.servico.registrarResolucao(this.gid, chave, dados);
    } catch (e) {
      // Outro jogador resolveu primeiro: a gravação duplicada é recusada pelas regras
      if (!this.estado.resolvido(chave)) throw e;
    }
    return tentativa;
  }

  #pontuacaoFinal(dadosFinal) {
    return Pontuacao.calcular({
      dificuldade: this.estado.dificuldade,
      resolvidos: this.estado.totalDeEnigmas,
      dicas: this.estado.dicasUsadas + dadosFinal.dicas,
      tentativas: this.estado.tentativasFalhas + dadosFinal.tentativas,
      restanteMs: this.restanteMs,
      concluida: true
    });
  }

  preparar() {
    this.gerenciador.preparar();
  }
}
