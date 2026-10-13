// Sala de jogo do grupo: lobby, partida multiplayer, chat e resultado

import { PaginaProtegida } from "./PaginaProtegida.js";
import { Grupo } from "../modelos/Grupo.js";
import { Dificuldade } from "../modelos/Dificuldade.js";
import { EstadoPartida } from "../modelos/EstadoPartida.js";
import { Icones } from "../nucleo/Icones.js";
import { Dom } from "../nucleo/Dom.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoGrupos } from "../servicos/ServicoGrupos.js";
import { ServicoPerfil } from "../servicos/ServicoPerfil.js";
import { ServicoSalas } from "../servicos/ServicoSalas.js";
import { ServicoPartida } from "../servicos/ServicoPartida.js";
import { Partida } from "../servicos/Partida.js";
import { MesaDeJogo } from "../componentes/MesaDeJogo.js";
import { PainelChat } from "../componentes/PainelChat.js";
import { PainelResultado } from "../componentes/PainelResultado.js";

export class PaginaSala extends PaginaProtegida {
  constructor() {
    super();
    this.grupos = new ServicoGrupos();
    this.perfis = new ServicoPerfil();
    this.salas = new ServicoSalas();
    this.servicoPartida = new ServicoPartida();
    this.mesa = null;
    this.partida = null;
    this.grupo = null;
    this.nomes = new Map();
    this.dificuldadeEscolhida = "facil";
    this.vista = "";
  }

  async montar() {
    this.idGrupo = new URLSearchParams(location.search).get("id") || "";
    if (!Grupo.idValido(this.idGrupo)) { location.replace("dashboard.html"); return; }

    this.el("link-grupo").href = `grupo.html?id=${encodeURIComponent(this.idGrupo)}`;
    this.sala = await this.#carregarSala();
    if (!this.sala) return;

    this.chat = new PainelChat(this.el("chat-sala"), { idGrupo: this.idGrupo, sessao: this.sessao });
    this.grupos.observar(this.idGrupo, (grupo) => this.#aoMudarGrupo(grupo), (e) => {
      notificador.falha(e, "Não foi possível abrir o grupo.");
      setTimeout(() => location.replace("dashboard.html"), 1500);
    });
  }

  async #carregarSala() {
    try {
      return await this.salas.carregar(ServicoSalas.SALA_INICIAL);
    } catch (e) {
      notificador.falha(e, "Não foi possível carregar a sala.");
      setTimeout(() => location.replace("dashboard.html"), 1500);
      return null;
    }
  }

  async #aoMudarGrupo(grupo) {
    if (!grupo || !grupo.contem(this.sessao.uid)) {
      notificador.erro("Você não faz parte deste grupo.");
      setTimeout(() => location.replace("dashboard.html"), 1200);
      return;
    }
    this.grupo = grupo;
    if (this.partida) { this.#desenhar(this.partida.estado); return; }

    this.partida = new Partida({ gid: this.idGrupo, sala: this.sala, servico: this.servicoPartida, uid: this.sessao.uid });
    this.partida.assinar((estado) => this.#desenhar(estado));
    this.chat.iniciar();
    await this.partida.observar((e) => {
      notificador.falha(e, "Não foi possível acompanhar a partida.");
    });
  }

  // Roteia a tela conforme o estado da partida

  #desenhar(estado) {
    if (!this.grupo) return;
    if (!estado) return this.#lobbySemPartida();
    if (estado.emEspera) return this.#lobbyAguardando(estado);
    if (estado.emAndamento) return this.#jogo();
    return this.#resultado(estado);
  }

  #mostrar(vista) {
    ["lobby", "jogo", "resultado"].forEach((v) => { this.el(`vista-${v}`).hidden = v !== vista; });
    this.el("caderno").hidden = vista !== "jogo";
    this.el("btn-desistir").hidden = vista !== "jogo" || !this.partida?.ehProprietario;
    this.vista = vista;
    Dom.pronto();
  }

  #desmontarMesa() {
    if (this.mesa) { this.mesa.destruir(); this.mesa = null; }
  }

  // Lobby

  #lobbySemPartida() {
    this.#desmontarMesa();
    const no = this.#cartaoLobby();

    if (this.grupo.ownerId !== this.sessao.uid) {
      no.appendChild(this.#paragrafo("Aguardando o proprietário do grupo criar a partida. Enquanto isso, combinem a estratégia no chat.", "sala-texto__destaque"));
    } else {
      no.appendChild(this.#seletorDeDificuldade());
      const criar = this.#botao("Criar partida", "btn-primary", (b) => this.#criarPartida(b));
      criar.classList.add("mt-3");
      no.appendChild(criar);
    }
    this.#publicarLobby(no);
  }

  #seletorDeDificuldade() {
    const campos = document.createElement("fieldset");
    campos.className = "sala-dificuldades";
    const legenda = document.createElement("legend");
    legenda.className = "sala-subtitulo";
    legenda.textContent = "Dificuldade";
    campos.appendChild(legenda);

    Dificuldade.ids().forEach((id) => {
      const nivel = Dificuldade.de(id);
      const rotulo = document.createElement("label");
      rotulo.className = "sala-dificuldade";
      rotulo.innerHTML = `<input type="radio" name="dificuldade" value="${id}">
        <span class="sala-dificuldade__nome"></span>
        <span class="sala-dificuldade__meta"></span>
        <span class="sala-dificuldade__foco"></span>`;
      const radio = rotulo.querySelector("input");
      radio.checked = id === this.dificuldadeEscolhida;
      radio.addEventListener("change", () => { this.dificuldadeEscolhida = id; });
      rotulo.querySelector(".sala-dificuldade__nome").textContent = nivel.nome;
      rotulo.querySelector(".sala-dificuldade__meta").textContent = `${nivel.minutos} minutos · ${nivel.enigmas} enigmas`;
      rotulo.querySelector(".sala-dificuldade__foco").textContent = nivel.foco;
      campos.appendChild(rotulo);
    });
    return campos;
  }

  async #criarPartida(botao) {
    Dom.ocupado(botao, true, "Gerando sala…");
    try {
      await this.partida.criar(this.dificuldadeEscolhida);
    } catch (e) {
      notificador.falha(e, "Não foi possível criar a partida.");
      Dom.ocupado(botao, false);
    }
  }

  #lobbyAguardando(estado) {
    this.#desmontarMesa();
    const nivel = Dificuldade.de(estado.dificuldade);
    const no = this.#cartaoLobby();

    const resumo = this.#paragrafo(`${nivel.nome} · ${nivel.minutos} minutos · ${nivel.enigmas} enigmas · semente ${estado.semente}`, "sala-lobby__resumo");
    no.appendChild(resumo);
    no.appendChild(this.#paragrafo(nivel.foco));

    const titulo = document.createElement("h3");
    titulo.className = "sala-subtitulo";
    titulo.textContent = `Jogadores (${estado.jogadores.length}/${EstadoPartida.MAX_JOGADORES})`;
    const lista = document.createElement("ul");
    lista.className = "sala-jogadores";
    no.append(titulo, lista);
    estado.jogadores.forEach((uid) => this.#itemJogador(lista, uid));

    const acoes = document.createElement("div");
    acoes.className = "d-flex gap-2 flex-wrap mt-3";
    if (!estado.participa(this.sessao.uid)) {
      if (estado.lotada) acoes.appendChild(this.#paragrafo("A partida já tem 3 jogadores. Você acompanha como observador.", "sala-texto__destaque"));
      else acoes.appendChild(this.#botao("Entrar na partida", "btn-primary", (b) => this.#entrar(b)));
    } else if (!this.partida.ehProprietario) {
      acoes.appendChild(this.#paragrafo("Você está na partida. Aguardando o proprietário iniciar.", "sala-texto__destaque"));
    }
    if (this.partida.ehProprietario) {
      acoes.appendChild(this.#botao("Iniciar partida", "btn-primary", (b) => this.#iniciar(b)));
      acoes.appendChild(this.#botao("Cancelar partida", "btn-outline-secondary", (b) => this.#cancelar(b)));
    }
    no.appendChild(acoes);
    this.#publicarLobby(no);
  }

  #itemJogador(lista, uid) {
    const li = document.createElement("li");
    const img = document.createElement("img");
    img.className = "ph-avatar";
    img.alt = "";
    const nome = document.createElement("span");
    nome.textContent = uid === this.sessao.uid ? "Você" : "…";
    li.append(img, nome);
    lista.appendChild(li);
    this.#perfil(uid).then((p) => {
      if (!p) return;
      img.src = p.avatar.url;
      nome.textContent = uid === this.sessao.uid ? `${p.username} (você)` : p.username;
    });
  }

  async #perfil(uid) {
    if (!this.nomes.has(uid)) this.nomes.set(uid, this.perfis.carregar(uid).catch(() => null));
    return this.nomes.get(uid);
  }

  async #entrar(botao) {
    Dom.ocupado(botao, true, "Entrando…");
    try {
      await this.partida.entrar();
    } catch (e) {
      notificador.falha(e, "Não foi possível entrar na partida.");
      Dom.ocupado(botao, false);
    }
  }

  async #iniciar(botao) {
    Dom.ocupado(botao, true, "Iniciando…");
    try {
      await this.partida.iniciar();
    } catch (e) {
      notificador.falha(e, "Não foi possível iniciar a partida.");
      Dom.ocupado(botao, false);
    }
  }

  async #cancelar(botao) {
    if (!confirm("Cancelar esta partida? A sala será gerada novamente na próxima.")) return;
    Dom.ocupado(botao, true, "Cancelando…");
    try {
      await this.partida.reiniciar();
    } catch (e) {
      notificador.falha(e, "Não foi possível cancelar a partida.");
      Dom.ocupado(botao, false);
    }
  }

  #cartaoLobby() {
    const no = document.createElement("div");
    no.className = "sala-lobby__cartao";
    const e = document.createElement("p");
    e.className = "sala-eyebrow";
    e.textContent = `Escape Room · ${this.sala.nome}`;
    const h = document.createElement("h1");
    h.className = "sala-titulo";
    h.textContent = this.grupo.name;
    no.append(e, h, this.#paragrafo(this.sala.descricao));
    return no;
  }

  #publicarLobby(no) {
    const vista = this.el("vista-lobby");
    vista.textContent = "";
    vista.appendChild(no);
    this.#mostrar("lobby");
    Icones.renderizar();
  }

  // Partida em andamento

  #jogo() {
    this.#mostrar("jogo");
    if (!this.mesa) {
      this.mesa = new MesaDeJogo({ palco: this.el("palco"), caderno: this.el("caderno"), partida: this.partida });
      this.mesa.iniciar();
      if (this.partida.participa) this.partida.preparar();
    }
    if (!this.ligouDesistir) {
      this.ligouDesistir = true;
      this.el("btn-desistir").addEventListener("click", () => this.#desistir());
    }
  }

  async #desistir() {
    if (!confirm("Encerrar a partida agora? A equipe perde o progresso.")) return;
    try {
      await this.partida.desistir();
    } catch (e) {
      notificador.falha(e, "Não foi possível encerrar a partida.");
    }
  }

  // Resultado

  #resultado(estado) {
    this.#desmontarMesa();
    const vista = this.el("vista-resultado");
    vista.textContent = "";
    vista.appendChild(PainelResultado.montar(estado, {
      ehProprietario: this.partida.ehProprietario,
      aoVoltar: () => location.assign(`grupo.html?id=${encodeURIComponent(this.idGrupo)}`),
      aoNova: (botao) => this.#novaPartida(botao)
    }));
    this.#mostrar("resultado");
  }

  async #novaPartida(botao) {
    Dom.ocupado(botao, true, "Preparando…");
    try {
      await this.partida.reiniciar();
    } catch (e) {
      notificador.falha(e, "Não foi possível preparar uma nova partida.");
      Dom.ocupado(botao, false);
    }
  }

  // Utilitários de DOM

  #paragrafo(texto, classe = "") {
    const p = document.createElement("p");
    p.className = classe;
    p.textContent = texto;
    return p;
  }

  #botao(texto, classe, aoClicar) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn ${classe} btn-sm`;
    b.textContent = texto;
    b.addEventListener("click", () => aoClicar(b));
    return b;
  }
}
