// Conquistas da aba Conquistas: títulos cômicos calculados aqui, a partir do status e das datas
// das vagas. Módulo puro, sem I/O. No modo anônimo, nenhum texto cita empresa ou cargo.
import { diasEntre, historicoEfetivo } from "./aventura.js";
import type { Status, Vaga } from "./vaga.js";

/** Dias parada numa etapa de espera para a conquista de silêncio. */
export const DIAS_SEM_FEEDBACK = 14;

/** Etapas em que a vaga espera resposta da empresa. */
const ESPERANDO: Status[] = ["candidatada", "triagem", "teste", "entrevista"];

export const IDS_CONQUISTAS = [
  "nao-passou-triagem",
  "silencio",
  "quase-la",
  "primeira-entrevista",
  "contratado",
] as const;
export type IdConquista = (typeof IDS_CONQUISTAS)[number];

export interface Conquista {
  id: IdConquista;
  titulo: string;
  /** Como desbloquear, em tom de piada. Serve de dica enquanto a conquista está bloqueada. */
  requisito: string;
  motivacao: string;
  desbloqueada: boolean;
  /** Dado concreto da conquista (ex.: dias de silêncio). Nunca cita empresa no modo anônimo. */
  detalhe: string | null;
}

/** A vaga já passou por alguma destas etapas, no histórico ou no status atual. */
function alcancou(vaga: Vaga, ...etapas: Status[]): boolean {
  return historicoEfetivo(vaga).some((h) => etapas.includes(h.status)) || etapas.includes(vaga.status);
}

/** Vaga esperando resposta há mais dias, com a data em que entrou na etapa atual. */
function maiorSilencio(vagas: Vaga[], hoje: string): { vaga: Vaga; dias: number } | null {
  let maior: { vaga: Vaga; dias: number } | null = null;
  for (const vaga of vagas) {
    if (!ESPERANDO.includes(vaga.status)) continue;
    const ultima = historicoEfetivo(vaga).reduce((a, h) => (h.data > a ? h.data : a), "");
    const dias = diasEntre(ultima, hoje);
    if (!maior || dias > maior.dias) maior = { vaga, dias };
  }
  return maior;
}

export function calcularConquistas(vagas: Vaga[], hoje: string, anonimo = false): Conquista[] {
  const silencio = maiorSilencio(vagas, hoje);
  const prefixo = silencio && !anonimo ? `${silencio.vaga.empresa}: ` : "";

  const porId: Record<IdConquista, Omit<Conquista, "id">> = {
    "nao-passou-triagem": {
      titulo: "Não passou da triagem",
      requisito: "Ser recusado antes de qualquer teste ou entrevista.",
      motivacao: "A triagem é um filtro de palavras-chave com pressa. O problema não é você, é o robô.",
      desbloqueada: vagas.some((v) => v.status === "recusada" && !alcancou(v, "teste", "entrevista", "oferta")),
      detalhe: null,
    },
    silencio: {
      titulo: "Empresa sem feedback há mais tempo",
      requisito: `Ter uma vaga esperando resposta há ${DIAS_SEM_FEEDBACK} dias ou mais.`,
      motivacao: "Silêncio também é resposta, só que demorada. Cobre com educação e siga em frente.",
      desbloqueada: silencio !== null && silencio.dias >= DIAS_SEM_FEEDBACK,
      detalhe: silencio ? `${prefixo}${silencio.dias} dias sem resposta` : null,
    },
    "quase-la": {
      titulo: "Quase chegou lá",
      requisito: "Chegar a uma entrevista e terminar sem oferta.",
      motivacao: "Você já chegou perto de onde muita gente nunca chega. Isso conta.",
      desbloqueada: vagas.some((v) => (v.status === "recusada" || v.status === "desistencia") && alcancou(v, "entrevista")),
      detalhe: null,
    },
    "primeira-entrevista": {
      titulo: "Primeira entrevista",
      requisito: "Chegar à entrevista de alguma vaga.",
      motivacao: "Alguém leu o currículo até o fim. Agora é só não se perder no link da chamada.",
      desbloqueada: vagas.some((v) => alcancou(v, "entrevista")),
      detalhe: null,
    },
    contratado: {
      titulo: "Contratado",
      requisito: "Receber uma oferta. Título supremo, sem pressa.",
      motivacao: "Você deixou de ser desempregado, oficialmente. Já pode desligar o alarme das 7h.",
      desbloqueada: vagas.some((v) => alcancou(v, "oferta")),
      detalhe: null,
    },
  };

  return IDS_CONQUISTAS.map((id) => ({ id, ...porId[id] }));
}
