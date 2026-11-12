// Portas: o que a aplicação precisa do mundo externo. Quem implementa é a infraestrutura.
import type { Metricas, NovaVaga, Status, Vaga } from "../dominio/vaga.js";

export interface FiltroVagas {
  status?: Status;
  anonimo?: boolean;
}

export interface VagaRepositorio {
  listar(filtro: FiltroVagas): Promise<Vaga[]>;
  obter(id: string, anonimo: boolean): Promise<Vaga>;
  registrar(nova: NovaVaga): Promise<Vaga>;
  atualizarStatus(id: string, status: Status, data?: string): Promise<Vaga>;
}

export interface RankingRepositorio {
  ranking(anonimo: boolean): Promise<Vaga[]>;
  metricas(): Promise<Metricas>;
}

export interface PlanilhaRepositorio {
  exportar(caminho: string): Promise<{ novas: number; existentes: number }>;
}
