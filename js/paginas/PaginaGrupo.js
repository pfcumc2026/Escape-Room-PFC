// Grupo: integrantes, presença, convites, link/QR Code e chat

import { PaginaProtegida } from "./PaginaProtegida.js";
import { Dom } from "../nucleo/Dom.js";
import { Texto } from "../nucleo/Texto.js";
import { Limites } from "../nucleo/Limites.js";
import { Icones } from "../nucleo/Icones.js";
import { notificador } from "../nucleo/Notificador.js";
import { Grupo } from "../modelos/Grupo.js";
import { ServicoPerfil } from "../servicos/ServicoPerfil.js";
import { ServicoGrupos } from "../servicos/ServicoGrupos.js";
import { ServicoConvites } from "../servicos/ServicoConvites.js";
import { ServicoChat } from "../servicos/ServicoChat.js";
import { ServicoPresenca } from "../servicos/ServicoPresenca.js";
import { Botao } from "../componentes/Botao.js";
import { QrCode } from "../componentes/QrCode.js";
import { Chat } from "../componentes/Chat.js";
import { ListaIntegrantes } from "../componentes/ListaIntegrantes.js";
import { ListaPendentes } from "../componentes/ListaPendentes.js";

export class PaginaGrupo extends PaginaProtegida {
  constructor() {
    super();
    this.perfis = new ServicoPerfil();
    this.grupos = new ServicoGrupos();
    this.convites = new ServicoConvites();
    this.chat = new ServicoChat();
    this.presenca = new ServicoPresenca();
    this.grupo = null;
    this.assinaturaChat = null;
    this.assinaturaPendentes = null;
  }

  async montar() {
    this.idGrupo = new URLSearchParams(location.search).get("id") || "";
    if (!Grupo.idValido(this.idGrupo)) { location.replace("dashboard.html"); return; }

    this.presenca.iniciar(this.sessao.uid);
    this.acoes = this.el("acoes-grupo");
    this.blocoConvites = this.el("bloco-convites");
    this.integrantes = new ListaIntegrantes(this.el("lista-integrantes"), {
      perfis: this.perfis,
      presenca: this.presenca,
      aoRemover: (uid, botao) => this.#removerIntegrante(uid, botao)
    });
    this.visaoChat = new Chat(this.el("chat"));
    this.qr = new QrCode(this.el("qrcode"), "QR Code indisponível.");

    this.#montarConvites();
    this.#montarChat();
    this.#observarGrupo();
  }

  #observarGrupo() {
    this.grupos.observar(this.idGrupo, (grupo) => {
      if (!grupo) { this.#abandonar("Este grupo não existe mais.", 1200); return; }
      if (!grupo.contem(this.sessao.uid)) { this.#abandonar("Você não faz parte deste grupo.", 1200); return; }

      this.grupo = grupo;
      Dom.texto("#nome-grupo", grupo.name);
      Dom.texto("#contagem", String(grupo.memberCount));
      Dom.texto("#papel", grupo.papel(this.sessao.uid));
      this.blocoConvites.classList.toggle("d-none", !this.ehProprietario);

      this.#desenharAcoes();
      this.integrantes.renderizar(grupo, this.sessao);
      if (this.ehProprietario && !this.assinaturaPendentes) this.#ouvirPendentes();
      if (!this.assinaturaChat) this.#ouvirChat();
    }, (e) => {
      notificador.falha(e, "Não foi possível abrir o grupo.");
      setTimeout(() => location.replace("dashboard.html"), 1500);
    });
  }

  get ehProprietario() {
    return !!this.grupo && this.grupo.ehProprietario(this.sessao.uid);
  }

  #abandonar(mensagem, espera) {
    notificador.erro(mensagem);
    setTimeout(() => location.replace("dashboard.html"), espera);
  }

  // Ações do topo
  #desenharAcoes() {
    this.acoes.textContent = "";
    if (this.ehProprietario) {
      this.acoes.appendChild(Botao.comIcone("Convite e QR Code", "qr-code", "btn-primary", () => this.#abrirConvite()));
      this.acoes.appendChild(Botao.comIcone("Excluir grupo", "trash-2", "btn-outline-secondary", (b) => this.#excluirGrupo(b)));
    } else {
      this.acoes.appendChild(Botao.comIcone("Sair do grupo", "log-out", "btn-outline-secondary", (b) => this.#sairDoGrupo(b)));
    }
    Icones.renderizar();
  }

  async #removerIntegrante(uid, botao) {
    Dom.ocupado(botao, true, "...");
    try {
      await this.grupos.removerIntegrante(this.idGrupo, uid);
      notificador.sucesso("Integrante removido.");
    } catch (e) {
      notificador.falha(e, "Não foi possível remover o integrante.");
    }
    Dom.ocupado(botao, false);
  }

  async #sairDoGrupo(botao) {
    if (!confirm("Deseja realmente sair deste grupo?")) return;
    Dom.ocupado(botao, true, "Saindo...");
    try {
      await this.grupos.sair(this.idGrupo, this.sessao.uid);
      location.replace("dashboard.html");
    } catch (e) {
      notificador.falha(e, "Não foi possível sair do grupo.");
      Dom.ocupado(botao, false);
    }
  }

  async #excluirGrupo(botao) {
    if (!confirm("Excluir o grupo apaga o chat e remove todos os integrantes. Continuar?")) return;
    Dom.ocupado(botao, true, "Excluindo...");
    try {
      await this.grupos.excluir(this.grupo, this.sessao.uid);
      location.replace("dashboard.html");
    } catch (e) {
      notificador.falha(e, "Não foi possível excluir o grupo.");
      Dom.ocupado(botao, false);
    }
  }

  // Convites
  #montarConvites() {
    this.el("form-convite").addEventListener("submit", (ev) => this.#enviarConvite(ev));
    this.el("btn-copiar").addEventListener("click", () => this.#copiarLink());
    this.el("btn-novo-codigo").addEventListener("click", (ev) => this.#novoCodigo(ev.currentTarget));
    this.pendentes = new ListaPendentes(this.el("lista-pendentes"), (convite) => this.#cancelarConvite(convite));
  }

  async #enviarConvite(ev) {
    ev.preventDefault();
    const btn = this.el("btn-convidar");
    const campo = this.el("convidado");
    const alvo = Texto.limpar(campo.value, Limites.usernameMax).replace(/\s/g, "").toLowerCase();

    if (!/^[a-z0-9_]{3,20}$/.test(alvo)) { notificador.erro("Username inválido."); return; }
    if (alvo === this.sessao.perfil.usernameLower) { notificador.erro("Você já faz parte do grupo."); return; }
    if (this.grupo.cheio) { notificador.erro("O grupo já está cheio."); return; }

    Dom.ocupado(btn, true, "Enviando...");
    try {
      await this.convites.enviar({ grupo: this.grupo, remetente: this.sessao.autor, alvo });
      campo.value = "";
      notificador.sucesso("Convite enviado.");
    } catch (e) {
      if (e.code === "permission-denied") notificador.erro("Convite não permitido: verifique o limite de jogadores.");
      else notificador.falha(e, "Não foi possível enviar o convite.");
    }
    Dom.ocupado(btn, false);
  }

  #ouvirPendentes() {
    this.assinaturaPendentes = this.convites.observarPendentesDoGrupo(
      this.idGrupo, this.sessao.uid,
      (convites) => this.pendentes.renderizar(convites),
      () => {}
    );
  }

  async #cancelarConvite(convite) {
    try {
      await this.convites.cancelar(convite.id);
    } catch (e) {
      notificador.falha(e, "Não foi possível cancelar.");
    }
  }

  // Link e QR Code
  #abrirConvite() {
    this.el("link-convite").value = this.grupo.linkConvite();
    this.qr.desenhar(this.grupo.linkConvite());
    new bootstrap.Modal(this.el("modal-convite")).show();
  }

  async #copiarLink() {
    try {
      await navigator.clipboard.writeText(this.grupo.linkConvite());
      notificador.sucesso("Link copiado.");
    } catch {
      this.el("link-convite").select();
      notificador.info("Copie o link selecionado.");
    }
  }

  async #novoCodigo(botao) {
    Dom.ocupado(botao, true, "Gerando...");
    try {
      this.grupo.inviteCode = await this.grupos.renovarCodigo(this.idGrupo);
      this.el("link-convite").value = this.grupo.linkConvite();
      this.qr.desenhar(this.grupo.linkConvite());
      notificador.sucesso("Novo código gerado. O link anterior deixou de valer.");
    } catch (e) {
      notificador.falha(e, "Não foi possível gerar um novo código.");
    }
    Dom.ocupado(botao, false);
  }

  // Chat
  #montarChat() {
    this.campoMsg = this.el("campo-msg");
    this.el("form-msg").addEventListener("submit", (ev) => this.#enviarMensagem(ev));
  }

  #ouvirChat() {
    this.assinaturaChat = this.chat.observar(
      this.idGrupo,
      (mensagens, agora) => this.visaoChat.renderizar(mensagens, this.sessao.uid, agora),
      (e) => notificador.falha(e, "Não foi possível carregar o chat.")
    );
  }

  async #enviarMensagem(ev) {
    ev.preventDefault();
    const btn = this.el("btn-msg");
    const texto = Texto.limpar(this.campoMsg.value, Limites.mensagemMax);
    if (!texto) return;

    Dom.ocupado(btn, true, "…");
    try {
      await this.chat.enviar(this.idGrupo, this.sessao.autor, texto);
      this.campoMsg.value = "";
    } catch (e) {
      if (e.code === "permission-denied") notificador.erro("Mensagem bloqueada pelo limite de envio.");
      else notificador.falha(e, "Não foi possível enviar a mensagem.");
    }
    Dom.ocupado(btn, false);
  }
}
