// Casos de uso: orquestram as portas. Não sabem de HTTP nem de gRPC.
import type { Metricas, NovaVaga, Status, Vaga } from "../dominio/vaga.js";
import type {
  AnaliseRepositorio,
  EntradaAnalise,
  PlanilhaRepositorio,
  RankingRepositorio,
  ResultadoAnalise,
  VagaRepositorio,
} from "./portas.js";

export interface Dependencias {
  vagas: VagaRepositorio;
  ranking: RankingRepositorio;
  planilha: PlanilhaRepositorio;
  analise: AnaliseRepositorio;
  hoje?: () => string;
}

export function criarCasosDeUso(dep: Dependencias) {
  const hoje = dep.hoje ?? (() => new Date().toISOString().slice(0, 10));

  return {
    listarVagas(filtro: { status?: Status; anonimo?: boolean }): Promise<Vaga[]> {
      return dep.vagas.listar(filtro);
    },

    obterVaga(id: string, anonimo = false): Promise<Vaga> {
      return dep.vagas.obter(id, anonimo);
    },

    registrarVaga(nova: NovaVaga): Promise<Vaga> {
      return dep.vagas.registrar({ ...nova, data: nova.data ?? hoje() });
    },

    atualizarStatus(id: string, status: Status, data?: string): Promise<Vaga> {
      return dep.vagas.atualizarStatus(id, status, data ?? hoje());
    },

    excluirVaga(id: string, anonimo = false): Promise<void> {
      return dep.vagas.excluir(id, anonimo);
    },

    ranking(anonimo = false): Promise<Vaga[]> {
      return dep.ranking.ranking(anonimo);
    },

    metricas(): Promise<Metricas> {
      return dep.ranking.metricas();
    },

    analisarCurriculo(entrada: EntradaAnalise): Promise<ResultadoAnalise> {
      return dep.analise.analisar(entrada);
    },

    exportarPlanilha(caminho: string): Promise<{ novas: number; existentes: number }> {
      return dep.planilha.exportar(caminho);
    },

    gerarPlanilha(caminho: string): Promise<void> {
      return dep.planilha.gerarModelo(caminho);
    },
  };
}

export type CasosDeUso = ReturnType<typeof criarCasosDeUso>;
