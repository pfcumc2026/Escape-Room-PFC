// Configuração e edição do perfil (username + avatar DiceBear)

import { PaginaProtegida } from "./PaginaProtegida.js";
import { Dom } from "../nucleo/Dom.js";
import { Texto } from "../nucleo/Texto.js";
import { Avatar } from "../nucleo/Avatar.js";
import { Limites } from "../nucleo/Limites.js";
import { notificador } from "../nucleo/Notificador.js";
import { ServicoPerfil } from "../servicos/ServicoPerfil.js";

export class PaginaPerfil extends PaginaProtegida {
  static QUANTIDADE_OPCOES = 6;

  constructor() {
    super({ exigirPerfil: false });
    this.perfis = new ServicoPerfil();
  }

  async montar() {
    const perfil = this.sessao.perfil;
    this.campoUsername = this.el("username");
    this.seletorEstilo = this.el("estilo-avatar");
    this.opcoes = this.el("opcoes-avatar");
    this.previa = this.el("avatar-atual");
    this.statusUsername = this.el("status-username");
    this.btnSalvar = this.el("btn-salvar");

    this.estilo = perfil?.avatarStyle || Avatar.ESTILOS[0];
    this.semente = perfil?.avatarSeed || Avatar.sementeAleatoria();

    Avatar.ESTILOS.forEach((estilo) => {
      const opcao = document.createElement("option");
      opcao.value = estilo;
      opcao.textContent = estilo;
      this.seletorEstilo.appendChild(opcao);
    });
    this.seletorEstilo.value = this.estilo;

    if (this.sessao.perfilCompleto) {
      Dom.texto("#perfil-etapa", "Editar perfil");
      this.campoUsername.value = perfil.username;
      this.el("link-voltar").classList.remove("d-none");
    }

    this.sementes = this.#novasSementes();
    this.#desenharOpcoes();
    this.#atualizar();

    this.seletorEstilo.addEventListener("change", () => {
      this.estilo = this.seletorEstilo.value;
      this.#desenharOpcoes();
      this.#atualizar();
    });
    this.el("btn-sortear").addEventListener("click", () => {
      this.semente = Avatar.sementeAleatoria();
      this.sementes = this.#novasSementes();
      this.#desenharOpcoes();
      this.#atualizar();
    });
    this.campoUsername.addEventListener("input", () => {
      this.statusUsername.textContent = "";
      this.#atualizar();
    });
    this.campoUsername.addEventListener("blur", () => this.#checarUsername());
    this.el("form-perfil").addEventListener("submit", (ev) => this.#salvar(ev));
  }

  #novasSementes() {
    const sementes = [this.semente];
    while (sementes.length < PaginaPerfil.QUANTIDADE_OPCOES) sementes.push(Avatar.sementeAleatoria());
    return sementes;
  }

  #desenharOpcoes() {
    this.opcoes.textContent = "";
    this.sementes.forEach((semente) => {
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "ph-avatar-pick";
      botao.setAttribute("aria-pressed", String(semente === this.semente));
      botao.setAttribute("aria-label", `Avatar ${semente}`);
      const img = document.createElement("img");
      img.className = "ph-avatar ph-avatar--md";
      img.alt = "";
      img.loading = "lazy";
      img.src = Avatar.url(this.estilo, semente);
      botao.appendChild(img);
      botao.addEventListener("click", () => {
        this.semente = semente;
        this.#atualizar();
        this.#desenharOpcoes();
      });
      this.opcoes.appendChild(botao);
    });
  }

  #atualizar() {
    this.previa.src = Avatar.url(this.estilo, this.semente);
    Dom.texto("#preview-username", this.campoUsername.value.trim() || "—");
  }

  #problemaNoUsername(valor) {
    if (!valor) return "Informe um username.";
    if (valor.length < Limites.usernameMin || valor.length > Limites.usernameMax)
      return `Use de ${Limites.usernameMin} a ${Limites.usernameMax} caracteres.`;
    if (!/^[a-zA-Z0-9_]+$/.test(valor)) return "Use apenas letras, números e underline.";
    return null;
  }

  #status(mensagem, cor) {
    this.statusUsername.textContent = mensagem;
    this.statusUsername.style.color = cor;
  }

  async #checarUsername() {
    const valor = this.campoUsername.value.trim();
    const problema = this.#problemaNoUsername(valor);
    if (problema) { this.#status(problema, "var(--ph-danger)"); return; }

    const perfil = this.sessao.perfil;
    if (perfil && valor.toLowerCase() === perfil.usernameLower) {
      this.#status("Seu username atual.", "var(--ph-muted)");
      return;
    }
    try {
      const livre = await this.perfis.usernameLivre(valor.toLowerCase());
      this.#status(livre ? "Disponível." : "Este username já está em uso.", livre ? "var(--ph-ok)" : "var(--ph-danger)");
    } catch (e) {
      console.warn("[Placeholder] checagem de username", e);
    }
  }

  async #salvar(ev) {
    ev.preventDefault();
    const valor = Texto.limpar(this.campoUsername.value, Limites.usernameMax).replace(/\s/g, "");
    const problema = this.#problemaNoUsername(valor);
    if (problema) { notificador.erro(problema); return; }

    Dom.ocupado(this.btnSalvar, true, "Salvando...");
    try {
      await this.perfis.salvar({
        uid: this.sessao.uid,
        username: valor,
        estilo: this.estilo,
        semente: this.semente,
        perfil: this.sessao.perfil,
        nomeExibicao: this.sessao.usuario.displayName || valor
      });
      notificador.sucesso("Perfil salvo.");
      setTimeout(() => location.replace("dashboard.html"), 600);
    } catch (e) {
      if (e.code === "permission-denied") notificador.erro("Este username já está em uso ou é inválido.");
      else notificador.falha(e, "Não foi possível salvar o perfil.");
      Dom.ocupado(this.btnSalvar, false);
    }
  }
}
