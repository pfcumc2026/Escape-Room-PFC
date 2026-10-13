// Área clicável desenhada sobre um render; coordenadas normalizadas entre 0 e 1

export class Hotspot {
  static FORMAS = ["rect", "poly"];
  static TIPOS = ["INSPECT", "CLUE", "PUZZLE", "OBJECT", "LOCKED", "DOOR", "CONTAINER", "DECORATION"];
  static ESTADOS = ["active", "locked", "hidden"];
  static ID_VALIDO = /^[A-Za-z0-9_-]{1,40}$/;
  static MAX_PONTOS = 24;

  // Campos que pertencem ao objeto e são iguais em todos os hotspots dele
  static CAMPOS_DO_OBJETO = ["name", "interactionType", "puzzleId", "clueId", "initialState", "requiredState", "description"];

  constructor(dados = {}) {
    this.id = dados.id || "";
    this.roomId = dados.roomId || "";
    this.renderId = dados.renderId || "";
    this.objectId = dados.objectId || dados.id || "";
    this.name = dados.name || "";
    this.shape = dados.shape === "poly" ? "poly" : "rect";
    this.coordinates = dados.coordinates || [0.4, 0.4, 0.6, 0.6];
    this.interactionType = dados.interactionType || "INSPECT";
    this.puzzleId = dados.puzzleId || "";
    this.clueId = dados.clueId || "";
    this.initialState = dados.initialState || "active";
    this.requiredState = dados.requiredState || "";
    this.description = dados.description || "";
    this.enabled = dados.enabled !== false;
  }

  static novoId() {
    return `h_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
  }

  paraDados() {
    return {
      id: this.id, roomId: this.roomId, renderId: this.renderId, objectId: this.objectId, name: this.name,
      shape: this.shape, coordinates: this.#arredondadas(), interactionType: this.interactionType,
      puzzleId: this.puzzleId, clueId: this.clueId, initialState: this.initialState,
      requiredState: this.requiredState, description: this.description, enabled: this.enabled
    };
  }

  #arredondadas() {
    const r = (v) => Math.round(v * 10000) / 10000;
    return this.shape === "poly" ? this.coordinates.map((p) => p.map(r)) : this.coordinates.map(r);
  }

  get pontos() {
    if (this.shape === "poly") return this.coordinates;
    const [x1, y1, x2, y2] = this.coordinates;
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
  }

  get caixa() {
    const xs = this.pontos.map((p) => p[0]);
    const ys = this.pontos.map((p) => p[1]);
    return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  }

  get area() {
    const { x1, y1, x2, y2 } = this.caixa;
    return (x2 - x1) * (y2 - y1);
  }

  contem(x, y) {
    const pts = this.pontos;
    let dentro = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
    return dentro;
  }

  mover(dx, dy) {
    const { x1, y1, x2, y2 } = this.caixa;
    const ajusteX = Math.min(Math.max(dx, -x1), 1 - x2);
    const ajusteY = Math.min(Math.max(dy, -y1), 1 - y2);
    if (this.shape === "rect") {
      const [a, b, c, d] = this.coordinates;
      this.coordinates = [a + ajusteX, b + ajusteY, c + ajusteX, d + ajusteY];
    } else {
      this.coordinates = this.coordinates.map(([x, y]) => [x + ajusteX, y + ajusteY]);
    }
  }

  // Erro de validação ou null
  validar() {
    if (!Hotspot.ID_VALIDO.test(this.id)) return "Identificador inválido.";
    if (!Hotspot.ID_VALIDO.test(this.objectId)) return "Identificador do objeto inválido.";
    if (!this.name.trim() || this.name.length > 60) return "Informe um nome de até 60 caracteres.";
    if (!Hotspot.TIPOS.includes(this.interactionType)) return "Tipo de interação inválido.";
    if (!Hotspot.ESTADOS.includes(this.initialState)) return "Estado inicial inválido.";
    if (this.description.length > 400) return "Descrição longa demais.";
    if (this.shape === "rect") {
      const c = this.coordinates;
      if (c.length !== 4 || c.some((v) => typeof v !== "number" || v < 0 || v > 1)) return "Retângulo inválido.";
      if (c[2] - c[0] < 0.005 || c[3] - c[1] < 0.005) return "Retângulo pequeno demais.";
    } else {
      const c = this.coordinates;
      if (c.length < 3 || c.length > Hotspot.MAX_PONTOS) return "O polígono precisa de 3 a 24 pontos.";
      if (c.some((p) => p.length !== 2 || p.some((v) => typeof v !== "number" || v < 0 || v > 1))) return "Polígono inválido.";
    }
    return null;
  }

  get candidatoAEnigma() {
    return ["PUZZLE", "OBJECT", "LOCKED", "CONTAINER"].includes(this.interactionType);
  }

  get candidatoAPista() {
    return ["CLUE", "INSPECT"].includes(this.interactionType);
  }

  get ehFinal() {
    return this.interactionType === "DOOR";
  }
}
