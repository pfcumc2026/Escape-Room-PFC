// Renderização dos ícones do Lucide

export class Icones {
  static renderizar() {
    if (window.lucide) window.lucide.createIcons();
  }
}
