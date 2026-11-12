import { describe, expect, it, vi } from "vitest";
import { criarCasosDeUso } from "../src/aplicacao/casos.js";
import { ErroNaoEncontrada } from "../src/aplicacao/erros.js";
import type { PlanilhaRepositorio, RankingRepositorio, VagaRepositorio } from "../src/aplicacao/portas.js";
import type { Vaga } from "../src/dominio/vaga.js";

const VAGA: Vaga = {
  id: "2026-01-10-acme-dev",
  data: "2026-01-10",
  empresa: "Acme",
  cargo: "Dev",
  senioridade: "pleno",
  area: "dotnet",
  modelo: "remoto",
  status: "analisada",
  criterios: { obrigatorios: 80, desejaveis: 50, experiencia: 70, dominio: 60, logistica: 90 },
  matchScore: 73,
  classificacao: "boa aderência",
  palavrasChave: [],
  lacunas: [],
  historico: [],
};

function dependencias() {
  const vagas: VagaRepositorio = {
    listar: vi.fn(async () => [VAGA]),
    obter: vi.fn(async () => VAGA),
    registrar: vi.fn(async () => VAGA),
    atualizarStatus: vi.fn(async () => VAGA),
  };
  const ranking: RankingRepositorio = {
    ranking: vi.fn(async () => [VAGA]),
    metricas: vi.fn(async () => ({ total: 1, enviadas: 0, chegaramEntrevista: 0, taxaConversao: 0 })),
  };
  const planilha: PlanilhaRepositorio = {
    exportar: vi.fn(async () => ({ novas: 1, existentes: 0 })),
  };
  return { vagas, ranking, planilha };
}

describe("casos de uso", () => {
  it("registrar usa a data de hoje quando não é informada", async () => {
    const dep = dependencias();
    const casos = criarCasosDeUso({ ...dep, hoje: () => "2026-02-03" });
    await casos.registrarVaga({
      empresa: "Acme", cargo: "Dev", senioridade: "pleno", area: "dotnet", modelo: "remoto",
      status: "analisada", criterios: VAGA.criterios, palavrasChave: [], lacunas: [],
    });
    expect(dep.vagas.registrar).toHaveBeenCalledWith(expect.objectContaining({ data: "2026-02-03" }));
  });

  it("atualizar status repassa id, status e data", async () => {
    const dep = dependencias();
    const casos = criarCasosDeUso({ ...dep, hoje: () => "2026-02-03" });
    await casos.atualizarStatus("x", "entrevista");
    expect(dep.vagas.atualizarStatus).toHaveBeenCalledWith("x", "entrevista", "2026-02-03");
  });

  it("erros do repositório chegam intactos ao chamador", async () => {
    const dep = dependencias();
    dep.vagas.obter = vi.fn(async () => { throw new ErroNaoEncontrada("vaga 'x' não encontrada"); });
    const casos = criarCasosDeUso(dep);
    await expect(casos.obterVaga("x")).rejects.toBeInstanceOf(ErroNaoEncontrada);
  });

  it("ranking e métricas delegam ao repositório de ranking", async () => {
    const dep = dependencias();
    const casos = criarCasosDeUso(dep);
    expect(await casos.ranking(true)).toEqual([VAGA]);
    expect(dep.ranking.ranking).toHaveBeenCalledWith(true);
    expect((await casos.metricas()).total).toBe(1);
  });
});
