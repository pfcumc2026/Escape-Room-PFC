// Normalização e formatação de texto

export class Texto {
  static limpar(valor, max = 500) {
    return String(valor ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  }

  static tempoRelativo(data) {
    if (!data) return "";
    const seg = Math.floor((Date.now() - data.getTime()) / 1000);
    if (seg < 60) return "agora";
    if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
    if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
    return data.toLocaleDateString("pt-BR");
  }
}
