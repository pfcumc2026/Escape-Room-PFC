// Tema claro/escuro compartilhado pelas páginas

import { Icones } from "./Icones.js";

export class Tema {
  static CHAVE = "ph-theme";

  atual() {
    return document.documentElement.getAttribute("data-bs-theme") === "light" ? "light" : "dark";
  }

  get escuro() {
    return this.atual() === "dark";
  }

  aplicar(nome) {
    document.documentElement.setAttribute("data-bs-theme", nome);
    try { localStorage.setItem(Tema.CHAVE, nome); } catch (e) { /* preferência apenas local */ }
    const btn = document.querySelector("[data-ph-theme-toggle]");
    if (!btn) return;
    btn.setAttribute("aria-label", nome === "dark" ? "Ativar modo claro" : "Ativar modo escuro");
    btn.innerHTML = `<i data-lucide="${nome === "dark" ? "sun" : "moon"}" aria-hidden="true"></i>`;
    Icones.renderizar();
  }

  alternar() {
    this.aplicar(this.escuro ? "light" : "dark");
  }

  iniciar() {
    this.aplicar(this.atual());
    document.querySelectorAll("[data-ph-theme-toggle]").forEach((btn) => {
      btn.addEventListener("click", () => this.alternar());
    });
  }

  // Cores usadas nos QR Codes
  get corTraco() { return this.escuro ? "#e6ebf2" : "#10161f"; }
  get corFundo() { return this.escuro ? "#121721" : "#ffffff"; }
}

export const tema = new Tema();
