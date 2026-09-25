// Switch que troca o tema no dashboard e nas configurações

import { tema } from "../nucleo/Tema.js";

export class InterruptorTema {
  constructor(entrada) {
    this.entrada = entrada;
    this.entrada.checked = tema.escuro;
    this.entrada.addEventListener("change", () => tema.aplicar(this.entrada.checked ? "dark" : "light"));
  }
}
