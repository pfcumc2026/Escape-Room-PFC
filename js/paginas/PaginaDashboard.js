// Painel: perfil resumido, grupos, convites e acesso às configurações

import { PaginaProtegida } from "./PaginaProtegida.js";
import { Dom } from "../nucleo/Dom.js";
import { Texto } from "../nucleo/Texto.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoPerfil } from "../servicos/ServicoPerfil.js";
import { ServicoGrupos } from "../servicos/ServicoGrupos.js";
import { ServicoConvites } from "../servicos/ServicoConvites.js";
import { ServicoPresenca } from "../servicos/ServicoPresenca.js";
import { InterruptorTema } from "../componentes/InterruptorTema.js";
import { ListaGrupos } from "../componentes/ListaGrupos.js";
import { ListaConvites } from "../componentes/ListaConvites.js";
import { ListaConvitesEnviados } from "../componentes/ListaConvitesEnviados.js";

export class PaginaDashboard extends PaginaProtegida {
  constructor() {
    super();
    this.perfis = new ServicoPerfil();
    this.grupos = new ServicoGrupos();
    this.convites = new ServicoConvites();
    this.presenca = new ServicoPresenca();
  }

  async montar() {
    this.presenca.iniciar(this.sessao.uid);
    this.#montarCabecalho();
    this.#observarGrupos();
    this.#montarCriacaoDeGrupo();
    this.#observarConvites();
  }

  #montarCabecalho() {
    const perfil = this.sessao.perfil;
    this.el("avatar").src = perfil.avatar.url;
    Dom.texto("#username", perfil.username);
    this.perfis.nomePrivado(this.sessao.uid)
      .then((nome) => Dom.texto("#nome", nome))
      .catch(() => {});
    this.perfis.ehAdministrador(this.sessao.uid)
      .then((admin) => { if (admin) this.el("link-auditoria").classList.replace("d-none", "d-inline-flex"); })
      .catch(() => {});

    new InterruptorTema(this.el("switch-tema"));
    this.el("btn-sair").addEventListener("click", () => this.controle.sair());
    this.el("btn-sair-modal").addEventListener("click", () => this.controle.sair());
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => new bootstrap.Tooltip(el));
  }

  #observarGrupos() {
    const lista = new ListaGrupos(this.el("lista-grupos"));
    this.grupos.observarDoUsuario(
      this.sessao.uid,
      (grupos) => lista.renderizar(grupos, this.sessao.uid),
      (e) => notificador.falha(e, "Não foi possível carregar seus grupos.")
    );
  }

  #montarCriacaoDeGrupo() {
    this.formGrupo = this.el("form-grupo");
    this.btnCriar = this.el("btn-criar-grupo");
    this.formGrupo.addEventListener("submit", (ev) => this.#criarGrupo(ev));
  }

  async #criarGrupo(ev) {
    ev.preventDefault();
    const nome = Texto.limpar(this.el("nome-grupo").value, 30);
    if (nome.length < 3) { notificador.erro("O nome do grupo precisa ter ao menos 3 caracteres."); return; }

    Dom.ocupado(this.btnCriar, true, "Criando...");
    try {
      const id = await this.grupos.criar(this.sessao.uid, nome);
      bootstrap.Modal.getInstance(this.el("modal-grupo")).hide();
      this.formGrupo.reset();
      location.href = `grupo.html?id=${encodeURIComponent(id)}`;
    } catch (e) {
      if (e.code === "permission-denied") notificador.erro("Aguarde alguns segundos antes de criar outro grupo.");
      else notificador.falha(e, "Não foi possível criar o grupo.");
      Dom.ocupado(this.btnCriar, false);
    }
  }

  #observarConvites() {
    const recebidos = new ListaConvites(this.el("lista-convites"), (convite, aceitar, botao) => this.#responder(convite, aceitar, botao));
    this.convites.observarRecebidos(
      this.sessao.uid,
      (convites) => {
        Dom.texto("#contador-convites", String(convites.length));
        recebidos.renderizar(convites);
      },
      (e) => notificador.falha(e, "Não foi possível carregar os convites.")
    );

    const enviados = new ListaConvitesEnviados(this.el("lista-enviados"));
    this.convites.observarEnviados(this.sessao.uid, (convites) => enviados.renderizar(convites), () => {});
  }

  async #responder(convite, aceitar, botao) {
    Dom.ocupado(botao, true, "...");
    try {
      await this.convites.responder(convite, aceitar, this.sessao.uid);
      if (aceitar) location.href = `grupo.html?id=${encodeURIComponent(convite.groupId)}`;
      else notificador.info("Convite recusado.");
    } catch (e) {
      if (e.code === "permission-denied") notificador.erro("O grupo está cheio ou o convite não é mais válido.");
      else notificador.falha(e, "Não foi possível responder ao convite.");
      Dom.ocupado(botao, false);
    }
  }
}
