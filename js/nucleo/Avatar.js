// Avatar gerado pela DiceBear a partir de um estilo e uma semente

export class Avatar {
  static ESTILOS = ["bottts", "shapes", "identicon", "thumbs", "pixel-art", "rings", "glass", "icons"];

  constructor(estilo, semente) {
    this.estilo = Avatar.ESTILOS.includes(estilo) ? estilo : Avatar.ESTILOS[0];
    this.semente = String(semente || "placeholder").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32) || "placeholder";
  }

  get url() {
    return `https://api.dicebear.com/9.x/${this.estilo}/svg?seed=${encodeURIComponent(this.semente)}`;
  }

  static url(estilo, semente) {
    return new Avatar(estilo, semente).url;
  }

  static sementeAleatoria() {
    return Math.random().toString(36).slice(2, 10);
  }
}
