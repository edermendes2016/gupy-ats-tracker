// Tipos do domínio no lado TypeScript. As regras (Match Score, funil, anonimato)
// continuam no serviço Python; aqui só descrevemos os dados que a interface usa.

export const STATUS = [
  "analisada",
  "descartada",
  "candidatada",
  "triagem",
  "teste",
  "entrevista",
  "oferta",
  "recusada",
  "desistencia",
] as const;
export type Status = (typeof STATUS)[number];

export const SENIORIDADES = ["junior", "pleno", "senior", "especialista", "nao_informada"] as const;
export type Senioridade = (typeof SENIORIDADES)[number];

export const MODELOS = ["remoto", "hibrido", "presencial"] as const;
export type Modelo = (typeof MODELOS)[number];

export const PESOS_CRITERIOS = {
  obrigatorios: 50,
  desejaveis: 15,
  experiencia: 15,
  dominio: 10,
  logistica: 10,
} as const;
export type NomeCriterio = keyof typeof PESOS_CRITERIOS;
export type Criterios = Record<NomeCriterio, number>;

export interface HistoricoItem {
  data: string;
  status: Status;
}

export interface Vaga {
  id: string;
  data: string;
  empresa: string;
  cargo: string;
  senioridade: Senioridade;
  area: string;
  modelo: Modelo | null;
  url?: string;
  status: Status;
  criterios: Criterios;
  matchScore: number;
  classificacao: string;
  palavrasChave: string[];
  lacunas: string[];
  historico: HistoricoItem[];
  descricao?: string;
  responsabilidades?: string;
  requisitos?: string;
}

export interface NovaVaga {
  data?: string;
  empresa: string;
  cargo: string;
  senioridade: Senioridade;
  area: string;
  modelo: Modelo | null;
  url?: string;
  status: Status;
  criterios: Criterios;
  palavrasChave: string[];
  lacunas: string[];
  descricao?: string;
  responsabilidades?: string;
  requisitos?: string;
}

export interface Metricas {
  total: number;
  enviadas: number;
  chegaramEntrevista: number;
  taxaConversao: number;
}
