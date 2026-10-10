// Objeto da sala: reúne os hotspots que o representam em cada render

export class ObjetoInterativo {
  constructor(id, hotspots) {
    this.id = id;
    this.hotspots = hotspots;
    this.base = hotspots[0];
  }

  static agrupar(hotspots) {
    const grupos = new Map();
    hotspots.forEach((h) => {
      if (!grupos.has(h.objectId)) grupos.set(h.objectId, []);
      grupos.get(h.objectId).push(h);
    });
    return new Map([...grupos].map(([id, lista]) => [id, new ObjetoInterativo(id, lista)]));
  }

  get nome() { return this.base.name; }
  get tipo() { return this.base.interactionType; }
  get descricao() { return this.base.description; }
  get puzzleId() { return this.base.puzzleId; }
  get clueId() { return this.base.clueId; }
  get estadoInicial() { return this.base.initialState; }
  get requisito() { return this.base.requiredState; }

  get ativo() {
    return this.hotspots.some((h) => h.enabled);
  }

  get candidatoAEnigma() { return this.base.candidatoAEnigma; }
  get candidatoAPista() { return this.base.candidatoAPista; }
  get ehFinal() { return this.base.ehFinal; }
}
