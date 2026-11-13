// Conquistas da aba Conquistas: títulos cômicos calculados aqui, a partir do status e das datas
// das vagas. Módulo puro, sem I/O. No modo anônimo, nenhum texto cita empresa ou cargo.
import { diasEntre, historicoEfetivo } from "./aventura.js";
import type { Status, Vaga } from "./vaga.js";

/** Dias parada numa etapa de espera para a conquista de silêncio. */
export const DIAS_SEM_FEEDBACK = 14;

/** Etapas em que a vaga espera resposta da empresa. */
const ESPERANDO: Status[] = ["candidatada", "triagem", "teste", "entrevista"];

/** Candidaturas com desfecho que uma faixa de Match Score precisa juntar para liberar a calibração. */
export const MINIMO_DESFECHOS_FAIXA = 10;

/** Faixas de Match Score com a mesma divisão do relatório (Python): 40-59, 60-79 e 80-100. */
export const FAIXAS_CALIBRACAO = [
  { id: "calibracao-aposta", nome: "Aposta", minimo: 40, maximo: 59 },
  { id: "calibracao-boa", nome: "Boa aderência", minimo: 60, maximo: 79 },
  { id: "calibracao-alta", nome: "Alta aderência", minimo: 80, maximo: 100 },
] as const;

export const IDS_CONQUISTAS = [
  "nao-passou-triagem",
  "silencio",
  "quase-la",
  "primeira-entrevista",
  "contratado",
  "calibracao-aposta",
  "calibracao-boa",
  "calibracao-alta",
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

/**
 * Intervalo de Wilson (95%) para k de n, em percentual inteiro. Com poucos casos, a taxa
 * simples engana; o intervalo mostra o quanto ainda não se sabe.
 */
export function intervaloWilson(k: number, n: number, z = 1.96): { inferior: number; superior: number } {
  const p = k / n;
  const z2 = z * z;
  const centro = (p + z2 / (2 * n)) / (1 + z2 / n);
  const meio = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return {
    inferior: Math.round(100 * Math.max(0, centro - meio)),
    superior: Math.round(100 * Math.min(1, centro + meio)),
  };
}

/** Vaga com desfecho: já teve resposta final (recusa, desistência, oferta) ou chegou à entrevista. */
function temDesfecho(vaga: Vaga): boolean {
  return ["recusada", "desistencia", "oferta"].includes(vaga.status) || alcancou(vaga, "entrevista");
}

/** Calibração de uma faixa: desfechos e os que chegaram à entrevista (ou oferta). */
function calibracaoDaFaixa(vagas: Vaga[], minimo: number, maximo: number): { desfechos: number; entrevistas: number } {
  const naFaixa = vagas.filter((v) => {
    const score = Math.round(v.matchScore);
    return score >= minimo && score <= maximo && temDesfecho(v);
  });
  return {
    desfechos: naFaixa.length,
    entrevistas: naFaixa.filter((v) => alcancou(v, "entrevista", "oferta")).length,
  };
}

function conquistaDeCalibracao(vagas: Vaga[], faixa: (typeof FAIXAS_CALIBRACAO)[number]): Omit<Conquista, "id"> {
  const { desfechos, entrevistas } = calibracaoDaFaixa(vagas, faixa.minimo, faixa.maximo);
  const liberada = desfechos >= MINIMO_DESFECHOS_FAIXA;
  const intervalo = liberada ? intervaloWilson(entrevistas, desfechos) : null;
  return {
    titulo: `Calibração: ${faixa.nome}`,
    requisito: `Juntar ${MINIMO_DESFECHOS_FAIXA} candidaturas com desfecho na faixa de ${faixa.minimo} a ${faixa.maximo} de Match Score.`,
    motivacao: liberada
      ? "Dados suficientes para ler a faixa sem chute. Se ela não converte, o corte é que precisa mudar, não você."
      : "Uma faixa só ensina alguma coisa com volume. Cada desfecho conta para a calibração.",
    desbloqueada: liberada,
    detalhe: intervalo
      ? `${entrevistas} de ${desfechos} viraram entrevista (${Math.round((100 * entrevistas) / desfechos)}%, IC 95%: ${intervalo.inferior}% a ${intervalo.superior}%)`
      : `Poucos dados ainda: ${desfechos} de ${MINIMO_DESFECHOS_FAIXA} desfechos`,
  };
}

export function calcularConquistas(vagas: Vaga[], hoje: string, anonimo = false): Conquista[] {
  const silencio = maiorSilencio(vagas, hoje);
  const prefixo = silencio && !anonimo ? `${silencio.vaga.empresa}: ` : "";

  const porId: Partial<Record<IdConquista, Omit<Conquista, "id">>> = {
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
      motivacao: "Missão cumprida! Pode ligar o alarme das 7h com orgulho: agora ele toca para um emprego seu.",
      desbloqueada: vagas.some((v) => alcancou(v, "oferta")),
      detalhe: null,
    },
  };

  for (const faixa of FAIXAS_CALIBRACAO) porId[faixa.id] = conquistaDeCalibracao(vagas, faixa);

  return IDS_CONQUISTAS.map((id) => ({ id, ...porId[id]! }));
}
