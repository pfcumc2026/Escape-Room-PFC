// Server-Sent Events: cada aba aberta mantém uma conexão; o servidor avisa que algo mudou
// e o front busca os dados de novo pela API REST. Fica em memória: vale para uma única instância.
export function criarTempoReal({ intervaloPing = 25000 } = {}) {
  const conexoes = new Map();
  const aoMudarPresenca = new Set();

  function enviar(resposta, dados) {
    resposta.write(`data: ${JSON.stringify(dados)}\n\n`);
  }

  return {
    abrir(uid, resposta) {
      resposta.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no"
      });
      enviar(resposta, { canal: "conectado" });

      const ficouOnline = !conexoes.has(uid);
      if (ficouOnline) conexoes.set(uid, new Set());
      conexoes.get(uid).add(resposta);
      if (ficouOnline) aoMudarPresenca.forEach((f) => f(uid, true));

      const ping = setInterval(() => resposta.write(": ping\n\n"), intervaloPing);
      resposta.on("close", () => {
        clearInterval(ping);
        const abertas = conexoes.get(uid);
        if (!abertas) return;
        abertas.delete(resposta);
        if (!abertas.size) {
          conexoes.delete(uid);
          aoMudarPresenca.forEach((f) => f(uid, false));
        }
      });
    },

    notificar(uids, canal) {
      for (const uid of new Set(uids)) {
        conexoes.get(String(uid))?.forEach((resposta) => enviar(resposta, { canal }));
      }
    },

    online(uid) {
      return conexoes.has(String(uid));
    },

    quandoPresencaMudar(funcao) {
      aoMudarPresenca.add(funcao);
    },

    encerrar() {
      conexoes.forEach((abertas) => abertas.forEach((r) => r.end()));
      conexoes.clear();
    }
  };
}
