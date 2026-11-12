// Tipos da interface. Espelham o JSON do BFF (server/). Não há regra de negócio aqui:
// o Match Score e a classificação chegam prontos do serviço Python.

export const STATUS = [
  "analisada", "descartada", "candidatada", "triagem", "teste",
  "entrevista", "oferta", "recusada", "desistencia",
] as const;
export type Status = (typeof STATUS)[number];

export const ROTULO_STATUS: Record<Status, string> = {
  analisada: "Analisada",
  descartada: "Descartada",
  candidatada: "Candidatada",
  triagem: "Triagem",
  teste: "Teste",
  entrevista: "Entrevista",
  oferta: "Oferta",
  recusada: "Recusada",
  desistencia: "Desistência",
};

export const SENIORIDADES = ["junior", "pleno", "senior", "especialista", "nao_informada"] as const;
export type Senioridade = (typeof SENIORIDADES)[number];

export const ROTULO_SENIORIDADE: Record<Senioridade, string> = {
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
  nao_informada: "Não informada",
};

export const MODELOS = ["remoto", "hibrido", "presencial"] as const;
export type Modelo = (typeof MODELOS)[number];

export const ROTULO_MODELO: Record<Modelo, string> = {
  remoto: "Remoto",
  hibrido: "Híbrido",
  presencial: "Presencial",
};

export const CRITERIOS = [
  { nome: "obrigatorios", rotulo: "Requisitos obrigatórios", peso: 50 },
  { nome: "desejaveis", rotulo: "Desejáveis", peso: 15 },
  { nome: "experiencia", rotulo: "Experiência", peso: 15 },
  { nome: "dominio", rotulo: "Domínio", peso: 10 },
  { nome: "logistica", rotulo: "Logística", peso: 10 },
] as const;
export type NomeCriterio = (typeof CRITERIOS)[number]["nome"];
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
