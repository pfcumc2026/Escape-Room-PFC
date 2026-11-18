import { naoEncontrado, requisicaoInvalida } from "../utils/erros.js";
import { ID_CHAVE, ehObjetoSimples } from "../utils/validacao.js";

const ID_SALA = /^[a-z0-9-]{1,40}$/;
const ARQUIVO = /^assets\/[A-Za-z0-9_./-]{1,120}$/;
const TIPOS = ["INSPECT", "CLUE", "PUZZLE", "OBJECT", "LOCKED", "DOOR", "CONTAINER", "DECORATION"];
const ESTADOS = ["active", "locked", "hidden"];
const DIRECOES = ["frente", "esquerda", "direita", "tras"];
const MAX_RENDERS = 40;
const MAX_HOTSPOTS = 400;
const MAX_PONTOS = 24;

const textoAte = (v, max, min = 0) => typeof v === "string" && v.length >= min && v.length <= max;
const fracao = (v) => typeof v === "number" && Number.isFinite(v) && v >= -0.5 && v <= 1.5;
const posicaoNoMapa = (m) => m === null || (ehObjetoSimples(m) && fracao(m.x) && fracao(m.y) && typeof m.angulo === "number");

function validarRender(r) {
  return ehObjetoSimples(r) && textoAte(r.id, 40, 1) && typeof r.arquivo === "string" && ARQUIVO.test(r.arquivo)
    && textoAte(r.titulo, 60) && typeof r.destaque === "boolean" && posicaoNoMapa(r.mapa ?? null)
    && Array.isArray(r.ligacoes) && r.ligacoes.length <= 8
    && r.ligacoes.every((l) => ehObjetoSimples(l) && textoAte(l.id, 40, 1) && textoAte(l.destino, 40, 1)
      && DIRECOES.includes(l.direcao) && fracao(l.x) && fracao(l.y));
}

// Mesmos campos e limites validados antes pelas Security Rules; polígonos ficam como lista de pares [x, y]
function validarHotspot(h, salaId) {
  if (!ehObjetoSimples(h)) return false;
  const coordenadas = h.shape === "rect"
    ? Array.isArray(h.coordinates) && h.coordinates.length === 4 && h.coordinates.every(fracao)
    : h.shape === "poly" && Array.isArray(h.coordinates) && h.coordinates.length >= 3 && h.coordinates.length <= MAX_PONTOS
      && h.coordinates.every((p) => Array.isArray(p) && p.length === 2 && p.every(fracao));
  return coordenadas && ID_CHAVE.test(h.id || "") && h.roomId === salaId && textoAte(h.renderId, 40, 1)
    && ID_CHAVE.test(h.objectId || "") && textoAte(h.name, 60, 1) && TIPOS.includes(h.interactionType)
    && textoAte(h.puzzleId, 40) && textoAte(h.clueId, 40) && ESTADOS.includes(h.initialState)
    && textoAte(h.requiredState, 40) && textoAte(h.description, 400) && typeof h.enabled === "boolean";
}

function campos(h) {
  const { id, roomId, renderId, objectId, name, shape, coordinates, interactionType, puzzleId, clueId, initialState, requiredState, description, enabled } = h;
  return { id, roomId, renderId, objectId, name, shape, coordinates, interactionType, puzzleId, clueId, initialState, requiredState, description, enabled };
}

function formatarSala(s) {
  return {
    id: s._id, nome: s.nome, descricao: s.descricao, renders: s.renders, mapa: s.mapa ?? null,
    publicada: s.publicada, hotspots: s.hotspots, updatedAt: s.updatedAt.getTime()
  };
}

// Jogadores recebem só a versão publicada; o administrador pode pedir o rascunho
export async function obterSala(ctx, usuario, id, { rascunho }) {
  if (!ID_SALA.test(id)) throw naoEncontrado("Sala não encontrada.", "SALA_INEXISTENTE");
  const sala = await ctx.db.collection("rooms").findOne({ _id: id });
  const podeVerRascunho = rascunho && usuario.role === "admin";
  if (!sala || (!sala.publicada && !podeVerRascunho)) throw naoEncontrado("Sala não encontrada.", "SALA_INEXISTENTE");
  return formatarSala(sala);
}

export async function salvarSala(ctx, id, corpo) {
  const invalida = (motivo) => requisicaoInvalida(`Sala inválida: ${motivo}.`, "SALA_INVALIDA");
  if (!ID_SALA.test(id)) throw invalida("identificador");
  if (!textoAte(corpo.nome, 60, 1)) throw invalida("nome");
  if (!textoAte(corpo.descricao, 300)) throw invalida("descrição");
  if (typeof corpo.publicada !== "boolean") throw invalida("publicação");
  if (!Array.isArray(corpo.renders) || corpo.renders.length > MAX_RENDERS || !corpo.renders.every(validarRender)) throw invalida("pontos de vista");
  const mapa = corpo.mapa ?? null;
  if (mapa !== null && !(ehObjetoSimples(mapa) && typeof mapa.arquivo === "string" && ARQUIVO.test(mapa.arquivo))) throw invalida("mapa");
  if (!Array.isArray(corpo.hotspots) || corpo.hotspots.length > MAX_HOTSPOTS) throw invalida("hotspots");
  const ruim = corpo.hotspots.find((h) => !validarHotspot(h, id));
  if (ruim) throw invalida(`hotspot ${ruim?.id || ""}`);

  const sala = {
    nome: corpo.nome, descricao: corpo.descricao, publicada: corpo.publicada,
    renders: corpo.renders.map((r) => ({
      id: r.id, arquivo: r.arquivo, titulo: r.titulo, destaque: r.destaque,
      mapa: r.mapa ? { x: r.mapa.x, y: r.mapa.y, angulo: r.mapa.angulo } : null,
      ligacoes: r.ligacoes.map(({ id: lid, destino, direcao, x, y }) => ({ id: lid, destino, direcao, x, y }))
    })),
    mapa: mapa && { arquivo: mapa.arquivo },
    hotspots: corpo.hotspots.map(campos), updatedAt: new Date()
  };
  await ctx.db.collection("rooms").replaceOne({ _id: id }, sala, { upsert: true });
  return formatarSala({ _id: id, ...sala });
}
