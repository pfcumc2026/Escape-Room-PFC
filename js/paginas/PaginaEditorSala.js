// Editor de salas (somente administradores): hotspots, regras de interação e pré-visualização

import { PaginaProtegida } from "./PaginaProtegida.js";
import { Dom } from "../nucleo/Dom.js";
import { notificador } from "../nucleo/Notificador.js";
import { GeradorProcedural } from "../nucleo/GeradorProcedural.js";
import { Hotspot } from "../modelos/Hotspot.js";
import { Sala } from "../modelos/Sala.js";
import { Dificuldade } from "../modelos/Dificuldade.js";
import { ModelosEnigma } from "../modelos/ModelosEnigma.js";
import { Pista } from "../modelos/Pista.js";
import { PontoDeVista } from "../modelos/PontoDeVista.js";
import { ServicoSalas } from "../servicos/ServicoSalas.js";
import { ServicoPartidaLocal } from "../servicos/ServicoPartidaLocal.js";
import { Partida } from "../servicos/Partida.js";
import { VisaoSala } from "../componentes/VisaoSala.js";
import { EditorHotspots } from "../componentes/EditorHotspots.js";
import { MesaDeJogo } from "../componentes/MesaDeJogo.js";
import { PainelResultado } from "../componentes/PainelResultado.js";

export class PaginaEditorSala extends PaginaProtegida {
  static TIPOS = {
    INSPECT: "Inspecionar (pode virar pista)",
    CLUE: "Pista",
    PUZZLE: "Enigma",
    OBJECT: "Objeto (pode virar enigma)",
    LOCKED: "Trancado (pode virar enigma)",
    CONTAINER: "Recipiente (pode virar enigma)",
    DOOR: "Saída / desafio final",
    DECORATION: "Decoração"
  };

  constructor() {
    super({ exigirAdmin: true });
    this.salas = new ServicoSalas();
    this.sala = null;
    this.sujo = false;
    this.preview = null;
  }

  async montar() {
    try {
      this.sala = await this.salas.carregarParaEdicao(ServicoSalas.SALA_INICIAL);
    } catch (e) {
      notificador.falha(e, "Não foi possível carregar a sala.");
      return;
    }

    this.visao = new VisaoSala(this.el("edit-palco"), { navegacao: false, aoTrocar: () => this.#aoTrocarRender() });
    this.editor = new EditorHotspots(this.visao, {
      sala: this.sala,
      aoSelecionar: (h) => this.#preencherFormulario(h),
      aoSelecionarSeta: (l) => this.#preencherSeta(l),
      aoAlterar: (info) => this.#aoAlterar(info)
    });
    this.#montarPontoDeVista();
    this.visao.definirSala(this.sala);

    this.#montarFormulario();
    this.#montarBarra();
    this.el("chk-publicada").checked = this.sala.publicada;
    this.#atualizarLista();
    this.#atualizarResumo();
    window.addEventListener("beforeunload", (ev) => { if (this.sujo) { ev.preventDefault(); ev.returnValue = ""; } });
  }

  // Barra superior

  #montarBarra() {
    this.el("ferramentas").querySelectorAll("[data-ferramenta]").forEach((b) => {
      b.addEventListener("click", () => this.#escolherFerramenta(b.dataset.ferramenta));
    });
    this.el("btn-excluir").addEventListener("click", () => this.editor.excluirSelecionado());
    this.el("btn-salvar").addEventListener("click", (ev) => this.#salvar(ev.currentTarget));
    this.el("btn-importar").addEventListener("click", () => this.#restaurarPadrao());
    this.el("btn-verificar").addEventListener("click", () => this.#testarGeracao());
    this.el("modo-editor").addEventListener("click", () => this.#trocarModo("editor"));
    this.el("modo-preview").addEventListener("click", () => this.#trocarModo("preview"));
    this.el("chk-publicada").addEventListener("change", (ev) => { this.sala.publicada = ev.target.checked; this.#marcarSujo(); });

    const seletor = this.el("pv-dificuldade");
    Dificuldade.ids().forEach((id) => seletor.appendChild(new Option(`${Dificuldade.de(id).nome} (${Dificuldade.de(id).minutos} min)`, id)));
    this.el("pv-iniciar").addEventListener("click", () => this.#iniciarPreview());
  }

  #escolherFerramenta(ferramenta) {
    this.editor.definirFerramenta(ferramenta);
    this.el("ferramentas").querySelectorAll("[data-ferramenta]").forEach((b) => b.classList.toggle("ativo", b.dataset.ferramenta === ferramenta));
  }

  #marcarSujo(valor = true) {
    this.sujo = valor;
    Dom.texto("#estado-edicao", valor ? "Alterações não salvas" : "Tudo salvo");
  }

  async #salvar(botao) {
    Dom.ocupado(botao, true, "Salvando…");
    try {
      await this.salas.salvar(this.sala);
      this.#marcarSujo(false);
      notificador.sucesso(this.sala.publicada ? "Sala salva e publicada." : "Rascunho salvo. Jogadores ainda veem a versão padrão.");
    } catch (e) {
      notificador.falha(e, "Não foi possível salvar a sala.");
    }
    Dom.ocupado(botao, false);
  }

  async #restaurarPadrao() {
    if (!confirm("Substituir os hotspots atuais pelos da sala padrão? As alterações não salvas serão perdidas.")) return;
    try {
      const padrao = await this.salas.carregarPadrao(this.sala.id);
      this.sala.renders = padrao.renders;
      this.sala.mapa = padrao.mapa;
      this.sala.definirHotspots(padrao.hotspots);
      this.#preencherSeletorDeRender();
      this.visao.mostrar(this.sala.inicio, { registrar: false });
      this.editor.selecionar(null);
      this.#marcarSujo();
      this.#atualizarLista();
      this.#atualizarResumo();
      notificador.info("Sala padrão restaurada. Salve para publicar.");
    } catch (e) {
      notificador.falha(e, "Não foi possível restaurar a sala padrão.");
    }
  }

  // Verifica se a configuração atual gera partidas válidas em todas as dificuldades
  #testarGeracao() {
    const linhas = [];
    let falhou = false;
    Dificuldade.ids().forEach((id) => {
      let falhas = 0;
      let motivo = "";
      for (let s = 1; s <= 60; s++) {
        try {
          GeradorProcedural.gerar({ sala: this.sala, dificuldade: id, semente: s * 7919 });
        } catch (e) { falhas++; motivo = e.message; }
      }
      if (falhas) falhou = true;
      linhas.push(falhas ? `${Dificuldade.de(id).nome}: ${falhas}/60 falhas (${motivo})` : `${Dificuldade.de(id).nome}: 60/60 sementes válidas`);
    });
    this.#atualizarResumo(linhas);
    if (falhou) notificador.erro("A sala não gera partidas válidas em todas as dificuldades. Veja o resumo.", 7000);
    else notificador.sucesso("A sala gera partidas válidas nas três dificuldades.");
  }

  // Lista e resumo

  #aoTrocarRender() {
    if (!this.editor) return;
    if (this.editor.selecionado && this.editor.selecionado.renderId !== this.visao.renderId) this.editor.selecionado = null;
    this.editor.seta = null;
    this.editor.desenhar();
    this.#preencherFormulario(this.editor.selecionado);
    this.#preencherSeta(null);
    this.#atualizarLista();
    this.#atualizarPontoDeVista();
  }

  // Ponto de vista: seletor, realce, posição no mapa e setas

  #montarPontoDeVista() {
    this.#preencherSeletorDeRender();
    const seletor = this.el("sel-render");
    seletor.addEventListener("change", () => this.visao.mostrar(seletor.value, { registrar: false }));
    this.el("btn-render-ant").addEventListener("click", () => this.#vizinho(-1));
    this.el("btn-render-prox").addEventListener("click", () => this.#vizinho(1));

    this.el("chk-destaque").addEventListener("change", (ev) => {
      this.visao.sala.render(this.visao.renderId).destaque = ev.target.checked;
      this.#marcarSujo();
    });

    const mapa = this.el("mapa-editor");
    const imagem = mapa.querySelector("img");
    if (this.sala.mapa) imagem.src = new URL(this.sala.mapa.arquivo, document.baseURI).href;
    this.el("bloco-mapa").hidden = !this.sala.mapa;
    mapa.addEventListener("click", (ev) => {
      const caixa = mapa.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (ev.clientX - caixa.left) / caixa.width));
      const y = Math.min(1, Math.max(0, (ev.clientY - caixa.top) / caixa.height));
      const render = this.sala.render(this.visao.renderId);
      render.mapa = { x, y, angulo: render.mapa?.angulo || 0 };
      this.#marcarSujo();
      this.#desenharMapa();
    });
    this.el("f-angulo").addEventListener("input", (ev) => {
      const render = this.sala.render(this.visao.renderId);
      if (!render.mapa) return;
      render.mapa.angulo = ((Number(ev.target.value) || 0) % 360 + 360) % 360;
      this.#marcarSujo();
    });

    const destino = this.el("s-destino");
    const direcao = this.el("s-direcao");
    Object.entries(PontoDeVista.DIRECOES).forEach(([valor, rotulo]) => direcao.appendChild(new Option(rotulo, valor)));
    destino.addEventListener("change", () => this.#aplicarSeta("destino", destino.value));
    direcao.addEventListener("change", () => this.#aplicarSeta("direcao", direcao.value));
  }

  #preencherSeletorDeRender() {
    const seletor = this.el("sel-render");
    seletor.textContent = "";
    this.sala.renders.forEach((r, i) => seletor.appendChild(new Option(`${String(i + 1).padStart(2, "0")} · ${r.titulo}`, r.id)));
  }

  #vizinho(passo) {
    const ids = this.sala.renders.map((r) => r.id);
    const i = ids.indexOf(this.visao.renderId);
    this.visao.mostrar(ids[(i + passo + ids.length) % ids.length], { registrar: false });
  }

  #atualizarPontoDeVista() {
    const render = this.sala.render(this.visao.renderId);
    this.el("sel-render").value = render.id;
    this.el("chk-destaque").checked = render.destaque;
    this.el("f-angulo").value = render.mapa ? Math.round(render.mapa.angulo) : "";
    this.el("f-angulo").disabled = !render.mapa;
    this.#desenharMapa();
    this.#atualizarListaDeSetas();
  }

  #desenharMapa() {
    const mapa = this.el("mapa-editor");
    mapa.querySelectorAll(".sala-edit__marca").forEach((m) => m.remove());
    this.sala.renders.filter((r) => r.mapa).forEach((r) => {
      const marca = document.createElement("span");
      marca.className = `sala-edit__marca${r.id === this.visao.renderId ? " sala-edit__marca--atual" : ""}`;
      marca.style.left = `${r.mapa.x * 100}%`;
      marca.style.top = `${r.mapa.y * 100}%`;
      marca.title = r.titulo;
      mapa.appendChild(marca);
    });
    this.el("f-angulo").disabled = !this.sala.render(this.visao.renderId).mapa;
  }

  #atualizarListaDeSetas() {
    const lista = this.el("lista-setas");
    lista.textContent = "";
    const render = this.sala.render(this.visao.renderId);
    if (!render.ligacoes.length) {
      const vazio = document.createElement("li");
      vazio.className = "sala-edit__ajuda";
      vazio.textContent = "Nenhuma seta. Use a ferramenta Seta.";
      lista.appendChild(vazio);
      return;
    }
    render.ligacoes.forEach((l) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = l === this.editor?.seta ? "atual" : "";
      const nome = document.createElement("span");
      nome.textContent = this.sala.render(l.destino)?.titulo || l.destino;
      const direcao = document.createElement("small");
      direcao.textContent = PontoDeVista.DIRECOES[l.direcao];
      b.append(nome, direcao);
      b.addEventListener("click", () => this.editor.selecionarSeta(l));
      li.appendChild(b);
      lista.appendChild(li);
    });
  }

  #preencherSeta(ligacao) {
    this.el("caixa-seta").hidden = !ligacao;
    this.#atualizarListaDeSetas();
    if (!ligacao) return;
    const destino = this.el("s-destino");
    destino.textContent = "";
    this.sala.renders.filter((r) => r.id !== this.visao.renderId)
      .forEach((r) => destino.appendChild(new Option(r.titulo, r.id)));
    destino.value = ligacao.destino;
    this.el("s-direcao").value = ligacao.direcao;
  }

  #aplicarSeta(campo, valor) {
    const ligacao = this.editor.seta;
    if (!ligacao) return;
    ligacao[campo] = valor;
    this.editor.desenhar();
    this.#atualizarListaDeSetas();
    this.#marcarSujo();
  }

  #aoAlterar() {
    this.#marcarSujo();
    this.#atualizarLista();
    this.#atualizarResumo();
  }

  #atualizarLista() {
    const lista = this.el("lista-hotspots");
    lista.textContent = "";
    const daTela = this.sala.hotspots.filter((h) => h.renderId === this.visao.renderId);
    if (!daTela.length) {
      const vazio = document.createElement("li");
      vazio.className = "sala-edit__ajuda";
      vazio.textContent = "Nenhum hotspot neste render.";
      lista.appendChild(vazio);
      return;
    }
    daTela.forEach((h) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = h === this.editor.selecionado ? "atual" : "";
      const nome = document.createElement("span");
      nome.textContent = h.name;
      const tipo = document.createElement("small");
      tipo.textContent = `${h.shape === "poly" ? "polígono" : "retângulo"} · ${h.interactionType}`;
      b.append(nome, tipo);
      b.addEventListener("click", () => this.editor.selecionar(h));
      li.appendChild(b);
      lista.appendChild(li);
    });
  }

  #atualizarResumo(extras = []) {
    const objetos = [...this.sala.objetos.values()];
    const conta = (fn) => objetos.filter(fn).length;
    const texto = [
      `${this.sala.hotspots.length} hotspots em ${objetos.length} objetos.`,
      `Candidatos a enigma: ${conta((o) => o.candidatoAEnigma)} · a pista: ${conta((o) => o.candidatoAPista)} · saídas: ${conta((o) => o.ehFinal)}.`,
      "Difícil exige 4 candidatos a enigma, 5 a pista e 1 saída.",
      `Pontos de vista alcançáveis: ${this.sala.rendersAlcancaveis.size} de ${this.sala.renders.length}.`,
      ...extras
    ];
    const no = this.el("texto-resumo");
    no.textContent = "";
    texto.forEach((t) => {
      const p = document.createElement("span");
      p.style.display = "block";
      p.textContent = t;
      no.appendChild(p);
    });
  }

  // Formulário do hotspot

  #montarFormulario() {
    const tipo = this.el("f-tipo");
    Object.entries(PaginaEditorSala.TIPOS).forEach(([valor, rotulo]) => tipo.appendChild(new Option(rotulo, valor)));

    const puzzle = this.el("f-puzzle");
    puzzle.appendChild(new Option("(sorteado pela semente)", ""));
    ModelosEnigma.TODOS.forEach((m) => puzzle.appendChild(new Option(`${m.titulo} — ${Dificuldade.de(m.nivel).nome}`, m.id)));

    const pista = this.el("f-pista");
    pista.appendChild(new Option("(padrão)", ""));
    Pista.ids().forEach((id) => pista.appendChild(new Option(Pista.SABORES[id].nome, id)));

    const ligar = (id, campo, evento = "input") => this.el(id).addEventListener(evento, (ev) => this.#aplicar(campo, ev.target.value));
    ligar("f-nome", "name");
    ligar("f-tipo", "interactionType", "change");
    ligar("f-puzzle", "puzzleId", "change");
    ligar("f-pista", "clueId", "change");
    ligar("f-estado", "initialState", "change");
    ligar("f-requisito", "requiredState", "change");
    ligar("f-descricao", "description");
    this.el("f-ativo").addEventListener("change", (ev) => {
      if (!this.editor.selecionado) return;
      this.editor.selecionado.enabled = ev.target.checked;
      this.editor.desenhar();
      this.#aoAlterar();
    });
    this.el("f-objeto").addEventListener("change", (ev) => this.#trocarObjeto(ev.target.value.trim()));
    this.el("form-hotspot").addEventListener("submit", (ev) => ev.preventDefault());
  }

  // Campos do objeto valem para todos os hotspots do mesmo objeto
  #aplicar(campo, valor) {
    const h = this.editor.selecionado;
    if (!h) return;
    this.sala.hotspots.filter((o) => o.objectId === h.objectId).forEach((o) => { o[campo] = valor; });
    this.sala.definirHotspots(this.sala.hotspots);
    this.#aoAlterar();
    this.editor.desenhar();
    if (["interactionType", "name"].includes(campo)) this.#atualizarListaDeObjetos();
  }

  #trocarObjeto(novoId) {
    const h = this.editor.selecionado;
    if (!h) return;
    if (!Hotspot.ID_VALIDO.test(novoId)) {
      notificador.erro("Use apenas letras, números, _ e - (até 40 caracteres).");
      this.el("f-objeto").value = h.objectId;
      return;
    }
    const existente = this.sala.hotspots.find((o) => o.objectId === novoId && o !== h);
    h.objectId = novoId;
    if (existente) Hotspot.CAMPOS_DO_OBJETO.forEach((c) => { h[c] = existente[c]; });
    this.sala.definirHotspots(this.sala.hotspots);
    this.#aoAlterar();
    this.#preencherFormulario(h);
  }

  #atualizarListaDeObjetos(atual = null) {
    const datalista = this.el("lista-objetos");
    datalista.textContent = "";
    this.sala.objetos.forEach((o) => datalista.appendChild(new Option(o.nome, o.id)));

    const requisito = this.el("f-requisito");
    requisito.textContent = "";
    requisito.appendChild(new Option("(nenhum)", ""));
    this.sala.objetos.forEach((o) => { if (o.id !== atual) requisito.appendChild(new Option(o.nome, o.id)); });
  }

  #preencherFormulario(h) {
    const form = this.el("form-hotspot");
    form.hidden = !h;
    this.el("inspetor-vazio").hidden = !!h;
    this.#atualizarLista();
    if (!h) return;

    this.#atualizarListaDeObjetos(h.objectId);
    this.el("f-nome").value = h.name;
    this.el("f-objeto").value = h.objectId;
    this.el("f-tipo").value = h.interactionType;
    this.el("f-puzzle").value = h.puzzleId;
    this.el("f-pista").value = h.clueId;
    this.el("f-estado").value = h.initialState;
    this.el("f-requisito").value = h.requiredState;
    this.el("f-descricao").value = h.description;
    this.el("f-ativo").checked = h.enabled;
    Dom.texto("#f-meta", `${h.id} · ${h.renderId} · ${h.shape}`);
  }

  // Pré-visualização como jogador

  #trocarModo(modo) {
    const preview = modo === "preview";
    this.el("area-editor").hidden = preview;
    this.el("area-preview").hidden = !preview;
    this.el("ferramentas").hidden = preview;
    this.el("modo-editor").classList.toggle("ativo", !preview);
    this.el("modo-preview").classList.toggle("ativo", preview);
    if (preview) {
      const invalido = this.sala.validar();
      if (invalido) notificador.erro(`Há um hotspot inválido: ${invalido}`);
      this.#iniciarPreview();
    } else {
      this.#encerrarPreview();
      this.editor.desenhar();
    }
  }

  #encerrarPreview() {
    if (!this.preview) return;
    this.preview.mesa?.destruir();
    this.preview.partida.destruir();
    this.preview = null;
    this.el("pv-palco").textContent = "";
    this.el("pv-caderno").textContent = "";
    this.el("pv-resultado").textContent = "";
    this.el("pv-gabarito").textContent = "";
    Dom.texto("#pv-info", "");
  }

  async #iniciarPreview() {
    this.#encerrarPreview();
    const dificuldade = this.el("pv-dificuldade").value || "facil";
    const partida = new Partida({
      gid: "preview", sala: Sala.deDados(this.sala.paraDados()), servico: new ServicoPartidaLocal(), uid: "admin-preview"
    });
    await partida.observar();

    try {
      await partida.criar(dificuldade);
      await partida.iniciar();
    } catch (e) {
      partida.destruir();
      notificador.falha(e, "Não foi possível gerar a sala de teste.");
      Dom.texto("#pv-info", e.message || "");
      return;
    }

    const mesa = new MesaDeJogo({ palco: this.el("pv-palco"), caderno: this.el("pv-caderno"), partida });
    this.preview = { partida, mesa };
    mesa.iniciar();
    partida.preparar();
    partida.assinar((estado) => this.#aoMudarPreview(estado));
    Dom.texto("#pv-info", `Semente ${partida.estado.semente}`);
    this.#desenharGabarito(partida);
  }

  #desenharGabarito(partida) {
    const lista = this.el("pv-gabarito");
    lista.textContent = "";
    partida.estado.config.ordem.forEach((chave) => {
      const e = partida.enigmas.get(chave);
      const conf = partida.estado.config.enigmas[chave];
      const nomes = (ids) => ids.map((id) => partida.sala.objeto(id).nome).join(" + ");
      const li = document.createElement("li");
      li.className = "sala-edit__item";
      li.textContent = `${chave}${e.final ? " (final)" : ""}: ${partida.sala.objeto(conf.objeto).nome} ← pista em ${nomes(conf.pistas)} · ${e.titulo} · código ${e.codigoEsperado}`;
      lista.appendChild(li);
    });
  }

  #aoMudarPreview(estado) {
    if (!estado?.encerrada || !this.preview) return;
    const resultado = this.el("pv-resultado");
    if (resultado.childElementCount) return;
    resultado.appendChild(PainelResultado.montar(estado, {
      ehProprietario: true,
      aoVoltar: () => this.#trocarModo("editor"),
      aoNova: () => this.#iniciarPreview()
    }));
  }
}
