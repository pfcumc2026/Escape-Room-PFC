// Contagem regressiva calculada localmente a partir do instante de expiração (relógio do servidor)

export class Cronometro {
  constructor({ expiraEm, deslocamentoMs = 0 }) {
    this.expiraEm = expiraEm;
    this.deslocamentoMs = deslocamentoMs;
    this.intervalo = null;
  }

  // Hora atual estimada do servidor
  agora() {
    return Date.now() + this.deslocamentoMs;
  }

  restanteMs() {
    return Math.max(0, this.expiraEm - this.agora());
  }

  get expirou() {
    return this.restanteMs() <= 0;
  }

  iniciar(aoTick, aoExpirar) {
    this.parar();
    const passo = () => {
      aoTick(this.restanteMs());
      if (this.expirou) {
        this.parar();
        aoExpirar();
      }
    };
    passo();
    if (this.intervalo === null && !this.expirou) this.intervalo = setInterval(passo, 500);
  }

  parar() {
    if (this.intervalo !== null) clearInterval(this.intervalo);
    this.intervalo = null;
  }

  static formatar(ms) {
    const total = Math.ceil(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const dois = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
  }
}
