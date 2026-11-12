// Mecânicas visuais da aba Aventura (Idle RPG). Tudo sai do estado já carregado:
// vagas, missões e métricas. Não há regra nova de XP aqui: o XP acumulado por vaga
// vem do BFF. Este módulo só lê o status e o match de cada vaga.
// Quando o modo anônimo está ligado, as vagas chegam já mascaradas (Empresa XX, sem link).
import type { Missao, Status, Vaga } from "./tipos";

/** Etapas em que a vaga espera resposta. São os "geradores" de XP. */
export const ETAPAS_EM_ESPERA: ReadonlyArray<Status> = ["analisada", "candidatada", "triagem"];

/** Etapas do funil que ainda não terminaram (atributo DEF). */
const ETAPAS_NO_FUNIL: ReadonlyArray<Status> = ["analisada", "candidatada", "triagem", "teste", "entrevista"];

/** XP por dia de cada etapa de espera. Espelha XP_POR_DIA do servidor (só o trecho de espera). */
const XP_POR_DIA_ESPERA: Partial<Record<Status, number>> = { analisada: 1, candidatada: 2, triagem: 3 };

/** Match Score a partir do qual a vaga ganha o buff. */
export const MATCH_ALTO = 70;

export const geradoresDeXp = (vagas: Vaga[]): Vaga[] => vagas.filter((v) => ETAPAS_EM_ESPERA.includes(v.status));

/** XP por dia que as vagas em espera rendem agora (Taxa de Farm Passivo). */
export const taxaPassiva = (vagas: Vaga[]): number =>
  geradoresDeXp(vagas).reduce((soma, v) => soma + (XP_POR_DIA_ESPERA[v.status] ?? 0), 0);

/** XP por dia de uma vaga em espera; zero para as demais. */
export const xpDiaDaVaga = (v: Vaga): number => XP_POR_DIA_ESPERA[v.status] ?? 0;

export const vagasNoFunil = (vagas: Vaga[]): number => vagas.filter((v) => ETAPAS_NO_FUNIL.includes(v.status)).length;

export const missoesFeitas = (missoes: Missao[]): number => missoes.filter((m) => m.concluida).length;

export const temBuffMatch = (v: Vaga): boolean => v.matchScore >= MATCH_ALTO;

export interface LinhaDiario {
  id: string;
  tom: "conquista" | "passivo" | "nivel";
  texto: string;
}

const LIMITE_DIARIO = 5;

/**
 * Linhas do Diário de Bordo, em ordem: missões cumpridas, vagas que rendem XP passivo
 * e o nível atual. Só usa o nome da empresa que já veio da API (mascarado no modo anônimo).
 */
export function diarioDeBordo(vagas: Vaga[], missoes: Missao[], nivel: number, titulo: string): LinhaDiario[] {
  const linhas: LinhaDiario[] = [];

  missoes
    .filter((m) => m.concluida)
    .slice(0, 2)
    .forEach((m) => {
      const detalhe = m.sugestao ? ` (${m.sugestao})` : "";
      linhas.push({ id: `missao-${m.id}`, tom: "conquista", texto: `✓ Missão cumprida: ${m.titulo}${detalhe}.` });
    });

  vagas
    .filter((v) => v.status === "triagem")
    .slice(0, 2)
    .forEach((v) => {
      linhas.push({
        id: `triagem-${v.id}`,
        tom: "passivo",
        texto: `⏳ [${v.empresa}] A vaga de ${v.cargo} está na Triagem gerando XP passivo.`,
      });
    });

  vagas
    .filter((v) => v.status === "candidatada")
    .slice(0, 2)
    .forEach((v) => {
      linhas.push({
        id: `candidatada-${v.id}`,
        tom: "passivo",
        texto: `📨 [${v.empresa}] Candidatura para ${v.cargo} aguardando resposta, rendendo XP.`,
      });
    });

  linhas.push({ id: "nivel", tom: "nivel", texto: `⬆ Personagem no nível ${nivel}: ${titulo}.` });

  return linhas.slice(0, LIMITE_DIARIO);
}
