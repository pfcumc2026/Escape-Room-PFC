// Fábrica dos botões criados por JavaScript

export class Botao {
  static simples(texto, classe, aoClicar) {
    const b = document.createElement("button");
    b.className = `btn ${classe} btn-sm`;
    b.textContent = texto;
    b.addEventListener("click", () => aoClicar(b));
    return b;
  }

  static comIcone(texto, icone, classe, aoClicar) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `btn ${classe} btn-sm d-inline-flex align-items-center gap-2`;
    const i = document.createElement("i");
    i.setAttribute("data-lucide", icone);
    i.setAttribute("aria-hidden", "true");
    b.append(i, document.createTextNode(texto));
    b.addEventListener("click", () => aoClicar(b));
    return b;
  }

  static link(texto, href, classe) {
    const a = document.createElement("a");
    a.className = `btn ${classe} btn-sm`;
    a.href = href;
    a.textContent = texto;
    return a;
  }
}
