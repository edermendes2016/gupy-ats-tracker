// Casos de uso: orquestram as portas. Não sabem de HTTP nem de gRPC.
import type { Metricas, NovaVaga, Status, Vaga } from "../dominio/vaga.js";
import type { PlanilhaRepositorio, RankingRepositorio, VagaRepositorio } from "./portas.js";

export interface Dependencias {
  vagas: VagaRepositorio;
  ranking: RankingRepositorio;
  planilha: PlanilhaRepositorio;
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

    ranking(anonimo = false): Promise<Vaga[]> {
      return dep.ranking.ranking(anonimo);
    },

    metricas(): Promise<Metricas> {
      return dep.ranking.metricas();
    },

    exportarPlanilha(caminho: string): Promise<{ novas: number; existentes: number }> {
      return dep.planilha.exportar(caminho);
    },
  };
}

export type CasosDeUso = ReturnType<typeof criarCasosDeUso>;
