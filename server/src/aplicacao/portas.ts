// Portas: o que a aplicação precisa do mundo externo. Quem implementa é a infraestrutura.
import type { Metricas, NovaVaga, Status, Vaga } from "../dominio/vaga.js";
import type { MissaoManual, RegistroDia } from "../dominio/missoes.js";

export interface FiltroVagas {
  status?: Status;
  anonimo?: boolean;
}

export interface VagaRepositorio {
  listar(filtro: FiltroVagas): Promise<Vaga[]>;
  obter(id: string, anonimo: boolean): Promise<Vaga>;
  registrar(nova: NovaVaga): Promise<Vaga>;
  atualizarStatus(id: string, status: Status, data?: string): Promise<Vaga>;
  excluir(id: string, anonimo: boolean): Promise<void>;
}

export interface RankingRepositorio {
  ranking(anonimo: boolean): Promise<Vaga[]>;
  metricas(): Promise<Metricas>;
}

export interface EntradaAnalise {
  nomeArquivo: string;
  curriculo: Buffer;
  descricao?: string;
  responsabilidades?: string;
  requisitos?: string;
  modelo?: string;
}

export interface ResultadoAnalise {
  criterios: Vaga["criterios"];
  matchScore: number;
  classificacao: string;
  palavrasChave: string[];
  lacunas: string[];
  avisos: string[];
  sugestoes: string[];
  anosCurriculo: number;
  anosPedidos: number | null;
  apresentacao: string;
  habilidadesValiosas: string[];
}

export interface AnaliseRepositorio {
  analisar(entrada: EntradaAnalise): Promise<ResultadoAnalise>;
}

export interface PlanilhaRepositorio {
  exportar(caminho: string): Promise<{ novas: number; existentes: number }>;
  gerarModelo(caminho: string): Promise<void>;
}

/** Marcações diárias das missões de estudo e reforço (dia AAAA-MM-DD -> registro). */
export interface MissoesRepositorio {
  ler(): Promise<Record<string, RegistroDia>>;
  marcar(dia: string, missao: MissaoManual, feita: boolean): Promise<void>;
}
