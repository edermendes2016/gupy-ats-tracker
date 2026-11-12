// Missões diárias: candidatar-se a 3 vagas, estudar uma lacuna e reforçar um ponto forte.
// Módulo puro, sem I/O. A candidatura é contada das vagas; estudo e reforço são marcados à mão
// e guardados só como sim ou não por dia, sem dado identificável.
import { historicoEfetivo } from "./aventura.js";
import type { Termo, Vaga } from "./vaga.js";

export const META_CANDIDATURAS = 3;
const DIA_MS = 24 * 60 * 60 * 1000;

export type TipoMissao = "candidaturas" | "estudo" | "reforco";
export type MissaoManual = "estudo" | "reforco";

/** Marcações feitas num dia. Ausente ou falso significa não feito. */
export interface RegistroDia {
  estudo?: boolean;
  reforco?: boolean;
}

export interface Missao {
  id: TipoMissao;
  titulo: string;
  descricao: string;
  progresso: number;
  meta: number;
  concluida: boolean;
  /** Termo sugerido pelas Métricas para o dia (lacuna ou ponto forte), quando há. */
  sugestao: string | null;
  /** Missões manuais se marcam à mão; a de candidaturas sai sozinha das vagas. */
  manual: boolean;
}

/** Quantas vagas foram candidatadas no dia (contando o histórico, ou a data de cadastro se não houver). */
export function candidaturasNoDia(vagas: Vaga[], dia: string): number {
  return vagas.filter((v) => historicoEfetivo(v).some((h) => h.status === "candidatada" && h.data === dia)).length;
}

/** Escolhe um termo por dia, em rodízio, para a sugestão mudar a cada dia sem sorteio. */
function sugestaoDoDia(termos: Termo[], dia: string, deslocamento: number): string | null {
  if (termos.length === 0) return null;
  const t = Date.parse(`${dia}T00:00:00Z`);
  const numeroDoDia = Number.isNaN(t) ? 0 : Math.floor(t / DIA_MS);
  const indice = (((numeroDoDia + deslocamento) % termos.length) + termos.length) % termos.length;
  return termos[indice]?.nome ?? null;
}

export function missoesDoDia(
  dia: string,
  vagas: Vaga[],
  registro: RegistroDia | undefined,
  termos: { pontosFortes: Termo[]; lacunas: Termo[] },
): Missao[] {
  const feitas = candidaturasNoDia(vagas, dia);
  const lacuna = sugestaoDoDia(termos.lacunas, dia, 0);
  const forte = sugestaoDoDia(termos.pontosFortes, dia, 0);
  return [
    {
      id: "candidaturas",
      titulo: `Candidatar-se a ${META_CANDIDATURAS} vagas`,
      descricao: "Cada vaga candidatada hoje conta. Não precisa ser perfeita, só enviada.",
      progresso: Math.min(feitas, META_CANDIDATURAS),
      meta: META_CANDIDATURAS,
      concluida: feitas >= META_CANDIDATURAS,
      sugestao: null,
      manual: false,
    },
    {
      id: "estudo",
      titulo: "Estudar uma lacuna",
      descricao: lacuna
        ? `Hoje o alvo é ${lacuna}. Marque quando estudar.`
        : "Ainda não há lacunas nas Métricas. Estude o que quiser e marque.",
      progresso: registro?.estudo ? 1 : 0,
      meta: 1,
      concluida: registro?.estudo === true,
      sugestao: lacuna,
      manual: true,
    },
    {
      id: "reforco",
      titulo: "Reforçar um ponto forte",
      descricao: forte
        ? `Hoje vale reforçar ${forte}. Marque quando reforçar.`
        : "Ainda não há pontos fortes nas Métricas. Reforce o que sabe melhor e marque.",
      progresso: registro?.reforco ? 1 : 0,
      meta: 1,
      concluida: registro?.reforco === true,
      sugestao: forte,
      manual: true,
    },
  ];
}

/** Total de missões concluídas em toda a história: dias com 3 candidaturas e marcações feitas. */
export function missoesConcluidas(vagas: Vaga[], registros: Record<string, RegistroDia>): number {
  const porDia = new Map<string, Set<string>>();
  for (const v of vagas) {
    for (const h of historicoEfetivo(v)) {
      if (h.status !== "candidatada") continue;
      const ids = porDia.get(h.data) ?? new Set<string>();
      ids.add(v.id);
      porDia.set(h.data, ids);
    }
  }
  let total = 0;
  for (const ids of porDia.values()) if (ids.size >= META_CANDIDATURAS) total += 1;
  for (const registro of Object.values(registros)) {
    if (registro.estudo) total += 1;
    if (registro.reforco) total += 1;
  }
  return total;
}
