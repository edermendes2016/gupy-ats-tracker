import { afterEach, describe, expect, it, vi } from "vitest";
import { criarCasosDeUso } from "../src/aplicacao/casos.js";
import { criarApp } from "../src/apresentacao/http/app.js";
import type { Vaga } from "../src/dominio/vaga.js";

const HOJE = "2026-02-01";
const vaga = (over: Partial<Vaga> = {}): Vaga => ({
  id: "v1", data: HOJE, empresa: "Acme", cargo: "Dev", senioridade: "pleno", area: "dotnet", modelo: "remoto",
  status: "candidatada", criterios: { obrigatorios: 1, desejaveis: 1, experiencia: 1, dominio: 1, logistica: 1 },
  matchScore: 50, classificacao: "x", palavrasChave: [], lacunas: [], historico: [{ data: HOJE, status: "candidatada" }],
  ...over,
});

describe("rotas de conquistas e missões", () => {
  let app: ReturnType<typeof criarApp> | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });

  function montar(vagas: Vaga[]) {
    const marcas: Record<string, Record<string, boolean>> = {};
    const casos = criarCasosDeUso({
      vagas: { listar: vi.fn(async () => vagas), obter: vi.fn(), registrar: vi.fn(), atualizarStatus: vi.fn(), excluir: vi.fn() } as never,
      ranking: {
        ranking: vi.fn(),
        metricas: vi.fn(async () => ({ pontosFortes: [{ nome: "C#", vagas: 2 }], lacunas: [{ nome: "Docker", vagas: 1 }] })),
      } as never,
      planilha: { exportar: vi.fn(), gerarModelo: vi.fn() } as never,
      analise: { analisar: vi.fn() } as never,
      hoje: () => HOJE,
    });
    app = criarApp(casos);
    return marcas;
  }

  it("GET /api/conquistas devolve as cinco conquistas, sem empresa no modo anônimo", async () => {
    montar([vaga({ status: "recusada", historico: [{ data: HOJE, status: "candidatada" }] })]);
    const r = await app!.inject({ method: "GET", url: "/api/conquistas?anonimo=true" });
    expect(r.statusCode).toBe(200);
    const lista = r.json() as Array<{ id: string; titulo: string }>;
    expect(lista).toHaveLength(5);
    expect(JSON.stringify(lista)).not.toContain("Acme");
  });

  it("GET /api/missoes traz as três missões do dia com a sugestão das métricas", async () => {
    montar([vaga()]);
    const r = await app!.inject({ method: "GET", url: "/api/missoes" });
    expect(r.statusCode).toBe(200);
    const corpo = r.json() as { dia: string; missoes: Array<{ id: string; sugestao: string | null }> };
    expect(corpo.dia).toBe(HOJE);
    expect(corpo.missoes.map((m) => m.id)).toEqual(["candidaturas", "estudo", "reforco"]);
    expect(corpo.missoes[1]?.sugestao).toBe("Docker");
  });

  it("POST /api/missoes/estudo marca a missão de hoje", async () => {
    montar([vaga()]);
    const r = await app!.inject({ method: "POST", url: "/api/missoes/estudo", payload: { feita: true } });
    expect(r.statusCode).toBe(200);
    expect(r.json().missoes[1]).toMatchObject({ id: "estudo", concluida: true });
  });

  it("missão desconhecida ou corpo inválido vira 400", async () => {
    montar([]);
    const porId = await app!.inject({ method: "POST", url: "/api/missoes/outra", payload: { feita: true } });
    expect(porId.statusCode).toBe(400);
    const porCorpo = await app!.inject({ method: "POST", url: "/api/missoes/estudo", payload: { feita: "sim" } });
    expect(porCorpo.statusCode).toBe(400);
  });

  it("GET /api/aventura inclui o bônus de conquistas e missões", async () => {
    montar([vaga({ status: "oferta", historico: [{ data: HOJE, status: "oferta" }] })]);
    const r = await app!.inject({ method: "GET", url: "/api/aventura" });
    expect(r.json().bonus).toBeGreaterThan(0); // conquista "Contratado" desbloqueada
  });
});
