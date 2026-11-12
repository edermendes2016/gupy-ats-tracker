import { afterEach, describe, expect, it, vi } from "vitest";
import {
  montarAventura, nivelDoXp, tituloDoNivel, xpPorEtapas, xpPorTempo, TETO_DIAS_POR_ETAPA,
} from "../src/dominio/aventura.js";
import { criarCasosDeUso } from "../src/aplicacao/casos.js";
import { criarApp } from "../src/apresentacao/http/app.js";
import type { Vaga } from "../src/dominio/vaga.js";

const base = (over: Partial<Vaga> = {}): Vaga => ({
  id: "v1", data: "2026-01-01", empresa: "Acme", cargo: "Dev Pleno", senioridade: "pleno", area: "dotnet",
  modelo: "remoto", status: "candidatada",
  criterios: { obrigatorios: 80, desejaveis: 50, experiencia: 70, dominio: 60, logistica: 90 },
  matchScore: 73, classificacao: "boa aderência", palavrasChave: [], lacunas: [],
  historico: [{ data: "2026-01-01", status: "candidatada" }],
  ...over,
});

describe("XP por tempo", () => {
  it("cresce com os dias parados numa etapa que rende", () => {
    // 5 dias em candidatada (2 XP/dia) = 10 XP
    expect(xpPorTempo([{ data: "2026-01-01", status: "candidatada" }], "2026-01-06")).toBe(10);
  });

  it("não rende nada para descartada, recusada ou desistência", () => {
    for (const status of ["descartada", "recusada", "desistencia", "analisada"] as const) {
      expect(xpPorTempo([{ data: "2026-01-01", status }], "2026-02-01")).toBe(0);
    }
  });

  it("fecha cada etapa na data da próxima mudança", () => {
    const historico = [
      { data: "2026-01-01", status: "candidatada" as const }, // 4 dias x 2 = 8
      { data: "2026-01-05", status: "entrevista" as const }, // 3 dias x 5 = 15
    ];
    expect(xpPorTempo(historico, "2026-01-08")).toBe(23);
  });

  it("aplica o teto de dias por etapa", () => {
    const xp = xpPorTempo([{ data: "2026-01-01", status: "oferta" }], "2027-01-01");
    expect(xp).toBe(TETO_DIAS_POR_ETAPA * 6);
  });

  it("ignora datas inválidas sem quebrar", () => {
    expect(xpPorTempo([{ data: "ruim", status: "teste" }], "2026-01-05")).toBe(0);
  });
});

describe("XP por etapas", () => {
  it("processos com mais etapas valem mais por etapa", () => {
    expect(xpPorEtapas({ atual: 1, total: 7 })).toBe(1 * (10 + 2 * 7));
    expect(xpPorEtapas({ atual: 1, total: 3 })).toBeLessThan(xpPorEtapas({ atual: 1, total: 7 }));
  });

  it("não passa de total e não aceita negativo", () => {
    expect(xpPorEtapas({ atual: 9, total: 2 })).toBe(xpPorEtapas({ atual: 2, total: 2 }));
    expect(xpPorEtapas({ atual: -3, total: 5 })).toBe(0);
  });
});

describe("nível e título", () => {
  it("sobe de nível com a raiz do XP", () => {
    expect(nivelDoXp(0)).toBe(1);
    expect(nivelDoXp(24)).toBe(1);
    expect(nivelDoXp(25)).toBe(2);
    expect(nivelDoXp(100)).toBe(3);
  });

  it("tem título para qualquer nível", () => {
    expect(tituloDoNivel(1)).toBe("Desempregado Iniciante");
    expect(tituloDoNivel(999)).toBe("Lenda do Processo Seletivo");
  });
});

describe("montarAventura", () => {
  const hoje = "2026-01-11";

  it("soma o XP das vagas e lista por vaga, em ordem", () => {
    const vagas = [base(), base({ id: "v2", empresa: "Beta", historico: [{ data: "2026-01-10", status: "triagem" }] })];
    const a = montarAventura(vagas, { v2: { atual: 1, total: 4 } }, hoje);
    // v2: 1 etapa de 4 (18 XP) + 1 dia em triagem (3 XP) = 21; v1: 10 dias em candidatada = 20.
    expect(a.vagas.map((v) => v.id)).toEqual(["v2", "v1"]);
    expect(a.vagas[0]?.xp).toBe(21);
    expect(a.xp).toBe(a.vagas.reduce((s, v) => s + v.xp, 0));
  });

  it("em modo anônimo não expõe a lista de vagas", () => {
    const a = montarAventura([base()], {}, hoje, true);
    expect(a.vagas).toEqual([]);
    expect(a.xp).toBeGreaterThan(0);
  });
});

describe("rotas da aventura", () => {
  let app: ReturnType<typeof criarApp> | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });

  function montar(vagas: Vaga[]) {
    const salvos: Record<string, unknown> = {};
    const casos = criarCasosDeUso({
      vagas: {
        listar: vi.fn(async () => vagas),
        obter: vi.fn(), registrar: vi.fn(), atualizarStatus: vi.fn(), excluir: vi.fn(),
      } as never,
      ranking: { ranking: vi.fn(), metricas: vi.fn() } as never,
      planilha: { exportar: vi.fn(), gerarModelo: vi.fn() } as never,
      analise: { analisar: vi.fn() } as never,
      progresso: {
        ler: async () => ({}),
        salvar: async (id, p) => { salvos[id] = p; },
      },
      hoje: () => hoje,
    });
    return { app: criarApp(casos), salvos };
  }
  const hoje = "2026-01-11";

  it("GET /api/aventura devolve o personagem", async () => {
    const m = montar([base()]);
    app = m.app;
    const r = await app.inject({ method: "GET", url: "/api/aventura" });
    expect(r.statusCode).toBe(200);
    expect(r.json().nivel).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/aventura/progresso grava pela empresa e cargo", async () => {
    const m = montar([base()]);
    app = m.app;
    const r = await app.inject({
      method: "POST", url: "/api/aventura/progresso",
      payload: { empresa: " acme ", cargo: "DEV PLENO", atual: 2, total: 8 },
    });
    expect(r.statusCode).toBe(200);
    expect(m.salvos.v1).toEqual({ atual: 2, total: 8 });
  });

  it("recusa atual maior que total com 400", async () => {
    const m = montar([base()]);
    app = m.app;
    const r = await app.inject({
      method: "POST", url: "/api/aventura/progresso",
      payload: { empresa: "Acme", cargo: "Dev Pleno", atual: 9, total: 8 },
    });
    expect(r.statusCode).toBe(400);
  });

  it("vaga não cadastrada vira 404", async () => {
    const m = montar([base()]);
    app = m.app;
    const r = await app.inject({
      method: "POST", url: "/api/aventura/progresso",
      payload: { empresa: "Ninguém", cargo: "Nada", atual: 1, total: 2 },
    });
    expect(r.statusCode).toBe(404);
  });
});
