// Gera e valida a configuração da partida a partir da semente e da dificuldade

import { Aleatorio } from "./Aleatorio.js";
import { ErroApp } from "./ErroApp.js";
import { Dificuldade } from "../modelos/Dificuldade.js";
import { Enigma } from "../modelos/Enigma.js";
import { EstadoPartida } from "../modelos/EstadoPartida.js";
import { ModelosEnigma } from "../modelos/ModelosEnigma.js";

export class GeradorProcedural {
  static MAX_TENTATIVAS = 25;
  static VERSAO = 1;

  // Regenera com outra derivação da mesma semente até obter uma configuração resolvível
  static gerar({ sala, dificuldade, semente }) {
    let ultimoErro = "";
    for (let tentativa = 0; tentativa < GeradorProcedural.MAX_TENTATIVAS; tentativa++) {
      const rng = Aleatorio.derivar(semente, `config${tentativa}`);
      const config = GeradorProcedural.#montar(sala, dificuldade, rng);
      ultimoErro = GeradorProcedural.validar(config, sala, dificuldade);
      if (!ultimoErro) return { config, tentativas: tentativa + 1 };
    }
    throw new ErroApp(`Não foi possível gerar uma sala válida: ${ultimoErro}`);
  }

  static #montar(sala, dificuldade, rng) {
    const total = Dificuldade.de(dificuldade).enigmas;
    const regulares = total - 1;
    const objetos = sala.objetosAtivos;
    const candidatosEnigma = rng.embaralhar(objetos.filter((o) => o.candidatoAEnigma));
    const candidatosPista = rng.embaralhar(objetos.filter((o) => o.candidatoAPista));
    const finais = objetos.filter((o) => o.ehFinal);

    if (!finais.length) throw new ErroApp("A sala não tem um objeto de saída (tipo DOOR).");
    if (candidatosEnigma.length < regulares) throw new ErroApp("A sala não tem objetos suficientes para os enigmas.");
    if (candidatosPista.length < total) throw new ErroApp("A sala não tem objetos suficientes para as pistas.");

    const objetosEnigma = [...candidatosEnigma.slice(0, regulares), rng.escolher(finais)];
    const modelos = GeradorProcedural.#sortearModelos(objetosEnigma, dificuldade, rng);

    const config = { versao: GeradorProcedural.VERSAO, ordem: [], enigmas: {}, pistas: {} };
    let pistasUsadas = 0;

    objetosEnigma.forEach((objeto, i) => {
      const final = i === total - 1;
      const chave = final ? "pf" : `p${i + 1}`;
      const enigma = Enigma.criar({
        chave, modeloId: modelos[i].id, variante: rng.inteiro(1, 999999999), dificuldade, final, objeto: objeto.id
      });

      const pecas = GeradorProcedural.#quantidadeDePecas(dificuldade, enigma, rng, candidatosPista.length - pistasUsadas - (total - i - 1));
      const anterior = i > 0 ? config.ordem[i - 1] : "";
      const objetosPista = candidatosPista.slice(pistasUsadas, pistasUsadas + pecas);
      pistasUsadas += pecas;

      config.ordem.push(chave);
      config.enigmas[chave] = {
        modeloId: modelos[i].id, variante: enigma.variante, objeto: objeto.id,
        pistas: objetosPista.map((o) => o.id), final
      };
      objetosPista.forEach((o, indice) => {
        config.pistas[o.id] = { enigma: chave, indice, requer: GeradorProcedural.#requisito(dificuldade, anterior, indice, rng) };
      });
    });
    return config;
  }

  static #sortearModelos(objetosEnigma, dificuldade, rng) {
    const pool = rng.embaralhar(ModelosEnigma.paraDificuldade(dificuldade));
    const usados = new Set();
    const escolhidos = objetosEnigma.map((objeto) => {
      const forcado = ModelosEnigma.porId(objeto.puzzleId);
      if (forcado && !usados.has(forcado.id)) { usados.add(forcado.id); return forcado; }
      return null;
    });
    return escolhidos.map((modelo) => {
      if (modelo) return modelo;
      const livre = pool.find((m) => !usados.has(m.id));
      if (!livre) throw new ErroApp("Não há modelos de enigma suficientes para esta dificuldade.");
      usados.add(livre.id);
      return livre;
    });
  }

  static #quantidadeDePecas(dificuldade, enigma, rng, folga) {
    const maximo = enigma.quantidadeMaximaDePecas;
    const desejado = dificuldade === "facil" ? 1 : dificuldade === "medio" ? (maximo > 1 && rng.chance(0.5) ? 2 : 1) : maximo;
    return Math.max(1, Math.min(desejado, folga));
  }

  // Médio: dependência ocasional; difícil: cadeia sequencial
  static #requisito(dificuldade, anterior, indice, rng) {
    if (!anterior || dificuldade === "facil") return "";
    if (dificuldade === "medio") return rng.chance(0.5) ? anterior : "";
    return indice === 0 ? anterior : "";
  }

  // Retorna a descrição do problema ou "" quando a configuração é válida e resolvível
  static validar(config, sala, dificuldade) {
    const nivel = Dificuldade.de(dificuldade);
    if (config.ordem.length !== nivel.enigmas) return "quantidade de enigmas incorreta";

    const usados = new Set();
    const reservar = (id) => {
      if (usados.has(id)) return false;
      usados.add(id);
      return true;
    };

    for (const chave of config.ordem) {
      const e = config.enigmas[chave];
      if (!e || !ModelosEnigma.porId(e.modeloId)) return `enigma ${chave} sem modelo`;
      if (!reservar(e.objeto)) return `objeto repetido: ${e.objeto}`;
      if (!GeradorProcedural.#objetoUsavel(sala, e.objeto)) return `objeto indisponível: ${e.objeto}`;
      if (!e.pistas.length) return `enigma ${chave} sem pistas`;
      for (const o of e.pistas) {
        const p = config.pistas[o];
        if (!p || p.enigma !== chave) return `pista ${o} sem vínculo`;
        if (p.requer && !config.ordem.includes(p.requer)) return `pista ${o} depende de enigma inexistente`;
        if (!reservar(o)) return `objeto repetido: ${o}`;
        if (!GeradorProcedural.#objetoUsavel(sala, o)) return `objeto indisponível: ${o}`;
      }
    }
    return GeradorProcedural.#simular(config, sala);
  }

  static #objetoUsavel(sala, id) {
    const objeto = sala.objeto(id);
    const alcancaveis = sala.rendersAlcancaveis;
    return !!objeto && objeto.ativo
      && objeto.hotspots.some((h) => h.enabled && h.validar() === null && alcancaveis.has(h.renderId));
  }

  // Simula um jogador que resolve tudo o que está liberado até não haver mais progresso
  static #simular(config, sala) {
    const estado = new EstadoPartida({ config });
    let progresso = true;
    while (progresso) {
      progresso = false;
      for (const [idObjeto] of Object.entries(config.pistas)) {
        if (!estado.pistaEncontrada(idObjeto) && estado.objetoLiberado(sala.objeto(idObjeto))) {
          estado.registrarPista(idObjeto, {});
          progresso = true;
        }
      }
      for (const chave of config.ordem) {
        const e = config.enigmas[chave];
        const pronto = e.pistas.every((o) => estado.pistaEncontrada(o))
          && estado.objetoLiberado(sala.objeto(e.objeto))
          && (!e.final || config.ordem.filter((k) => k !== chave).every((k) => estado.resolvido(k)));
        if (!estado.resolvido(chave) && pronto) {
          estado.registrarResolucao(chave, {});
          progresso = true;
        }
      }
    }
    return estado.totalResolvidos === config.ordem.length ? "" : "o objetivo final não é alcançável";
  }
}
