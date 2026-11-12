// Aventura: regras do XP do personagem desempregado. Módulo puro, sem I/O.
// O XP vem de dois lugares, ambos calculados aqui no servidor:
//   1. Tempo em cada status, a partir do histórico gravado pelo servidor (datas por dia).
//   2. Etapas concluídas de um processo seletivo, informadas pela extensão ou à mão.
import type { HistoricoItem, Status, Vaga } from "./vaga.js";

/** XP por dia parado em cada etapa. Descartada, recusada, desistência e analisada não rendem. */
export const XP_POR_DIA: Partial<Record<Status, number>> = {
  candidatada: 2,
  triagem: 3,
  teste: 4,
  entrevista: 5,
  oferta: 6,
};

/** Teto de dias contados por etapa e por vaga, para ninguém farmar uma vaga parada. */
export const TETO_DIAS_POR_ETAPA = 30;

/** XP base por etapa concluída, mais um bônus por etapa do processo inteiro. */
export const XP_BASE_ETAPA = 10;
export const XP_POR_ETAPA_DO_PROCESSO = 2;

/** Nível n começa em 25 * (n-1)^2 XP. */
const XP_BASE_NIVEL = 25;

export const TITULOS = [
  "Desempregado Iniciante",
  "Currículo em Revisão",
  "Caçador de Vagas Abertas",
  "Veterano da Triagem",
  "Sobrevivente do Teste Técnico",
  "Frequentador de Entrevistas",
  "Negociador de Proposta",
  "Quase Contratado",
  "Lenda do Processo Seletivo",
] as const;

export interface ProgressoEtapas {
  atual: number;
  total: number;
}

export interface XpVaga {
  id: string;
  empresa: string;
  cargo: string;
  xp: number;
}

export interface Aventura {
  nivel: number;
  titulo: string;
  xp: number;
  xpNivelAtual: number;
  xpProximoNivel: number;
  /** Zero em modo anônimo: a lista por vaga nunca sai da máquina nesse modo. */
  vagas: XpVaga[];
}

const DIA_MS = 24 * 60 * 60 * 1000;

function diasEntre(inicio: string, fim: string): number {
  const a = Date.parse(`${inicio}T00:00:00Z`);
  const b = Date.parse(`${fim}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / DIA_MS));
}

/** XP acumulado por tempo em cada etapa do histórico. `hoje` fecha a etapa atual. */
export function xpPorTempo(historico: HistoricoItem[], hoje: string): number {
  const ordenado = [...historico].sort((x, y) => x.data.localeCompare(y.data));
  let xp = 0;
  ordenado.forEach((item, i) => {
    const taxa = XP_POR_DIA[item.status] ?? 0;
    if (!taxa) return;
    const fim = ordenado[i + 1]?.data ?? hoje;
    const dias = Math.min(diasEntre(item.data, fim), TETO_DIAS_POR_ETAPA);
    xp += dias * taxa;
  });
  return xp;
}

/** XP das etapas concluídas. Processos com mais etapas valem mais por etapa. */
export function xpPorEtapas(progresso: ProgressoEtapas): number {
  const total = Math.max(0, Math.floor(progresso.total));
  const atual = Math.min(Math.max(0, Math.floor(progresso.atual)), total);
  return atual * (XP_BASE_ETAPA + XP_POR_ETAPA_DO_PROCESSO * total);
}

export function xpDaVaga(vaga: Vaga, hoje: string, progresso?: ProgressoEtapas): number {
  return xpPorTempo(vaga.historico, hoje) + (progresso ? xpPorEtapas(progresso) : 0);
}

export function nivelDoXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / XP_BASE_NIVEL)) + 1;
}

export function tituloDoNivel(nivel: number): string {
  const indice = Math.min(Math.max(nivel, 1), TITULOS.length) - 1;
  return TITULOS[indice] ?? TITULOS[0]!;
}

/** Monta o personagem a partir das vagas e do progresso por etapas (id -> progresso). */
export function montarAventura(
  vagas: Vaga[],
  progressos: Record<string, ProgressoEtapas>,
  hoje: string,
  anonimo = false,
): Aventura {
  const itens: XpVaga[] = vagas.map((v) => ({
    id: v.id,
    empresa: v.empresa,
    cargo: v.cargo,
    xp: xpDaVaga(v, hoje, progressos[v.id]),
  }));
  const xp = itens.reduce((soma, i) => soma + i.xp, 0);
  const nivel = nivelDoXp(xp);
  return {
    nivel,
    titulo: tituloDoNivel(nivel),
    xp,
    xpNivelAtual: XP_BASE_NIVEL * (nivel - 1) ** 2,
    xpProximoNivel: XP_BASE_NIVEL * nivel ** 2,
    vagas: anonimo ? [] : itens.filter((i) => i.xp > 0).sort((a, b) => b.xp - a.xp),
  };
}
