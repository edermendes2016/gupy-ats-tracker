import { afterEach, describe, expect, it, vi } from "vitest";
import { criarCasosDeUso } from "../src/aplicacao/casos.js";
import { ErroConflito, ErroNaoEncontrada } from "../src/aplicacao/erros.js";
import { criarApp } from "../src/apresentacao/http/app.js";
import type { Vaga } from "../src/dominio/vaga.js";

const VAGA: Vaga = {
  id: "v1", data: "2026-01-10", empresa: "Acme", cargo: "Dev", senioridade: "pleno", area: "dotnet",
  modelo: "remoto", status: "analisada",
  criterios: { obrigatorios: 80, desejaveis: 50, experiencia: 70, dominio: 60, logistica: 90 },
  matchScore: 73, classificacao: "boa aderência", palavrasChave: [], lacunas: [], historico: [],
};

function montar(sobrescrever: Partial<Parameters<typeof criarCasosDeUso>[0]["vagas"]> = {}) {
  const casos = criarCasosDeUso({
    vagas: {
      listar: vi.fn(async () => [VAGA]),
      obter: vi.fn(async () => VAGA),
      registrar: vi.fn(async () => VAGA),
      atualizarStatus: vi.fn(async () => VAGA),
      ...sobrescrever,
    },
    ranking: {
      ranking: vi.fn(async () => [VAGA]),
      metricas: vi.fn(async () => ({ total: 1, enviadas: 0, chegaramEntrevista: 0, taxaConversao: 0 })),
    },
    planilha: { exportar: vi.fn(async () => ({ novas: 0, existentes: 1 })) },
    analise: { analisar: vi.fn(async () => RESULTADO_ANALISE) },
    hoje: () => "2026-02-03",
  });
  return criarApp(casos);
}

const RESULTADO_ANALISE = {
  criterios: { obrigatorios: 67, desejaveis: 50, experiencia: 50, dominio: 50, logistica: 100 },
  matchScore: 64, classificacao: "boa aderência", palavrasChave: ["C#"], lacunas: ["RabbitMQ"],
  avisos: [], sugestoes: ["RabbitMQ está na vaga e não aparece no currículo."], anosCurriculo: 7.9, anosPedidos: null,
};

const NOVA = {
  empresa: "Acme", cargo: "Dev", criterios: { obrigatorios: 80, desejaveis: 50, experiencia: 70, dominio: 60, logistica: 90 },
};

let app: ReturnType<typeof criarApp> | undefined;
afterEach(async () => { await app?.close(); app = undefined; });

describe("rotas HTTP", () => {
  it("lista vagas e repassa o filtro de status validado", async () => {
    app = montar();
    const r = await app.inject({ method: "GET", url: "/api/vagas?status=entrevista&anonimo=true" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toHaveLength(1);
  });

  it("rejeita status inválido com 400", async () => {
    app = montar();
    const r = await app.inject({ method: "GET", url: "/api/vagas?status=inexistente" });
    expect(r.statusCode).toBe(400);
  });

  it("cria vaga com 201 e valida critérios fora da faixa", async () => {
    app = montar();
    const ok = await app.inject({ method: "POST", url: "/api/vagas", payload: NOVA });
    expect(ok.statusCode).toBe(201);
    const ruim = await app.inject({
      method: "POST", url: "/api/vagas",
      payload: { ...NOVA, criterios: { ...NOVA.criterios, dominio: 101 } },
    });
    expect(ruim.statusCode).toBe(400);
    expect(ruim.json().erro).toContain("dominio");
  });

  it("traduz não encontrada e conflito", async () => {
    app = montar({ obter: async () => { throw new ErroNaoEncontrada("não encontrada"); } });
    expect((await app.inject({ method: "GET", url: "/api/vagas/x" })).statusCode).toBe(404);
    await app.close();
    app = montar({ registrar: async () => { throw new ErroConflito("duplicada"); } });
    expect((await app.inject({ method: "POST", url: "/api/vagas", payload: NOVA })).statusCode).toBe(409);
  });

  it("atualiza status e exporta planilha", async () => {
    app = montar();
    const s = await app.inject({ method: "PATCH", url: "/api/vagas/v1/status", payload: { status: "oferta" } });
    expect(s.statusCode).toBe(200);
    const p = await app.inject({ method: "POST", url: "/api/planilha", payload: { caminho: "/tmp/x.xlsx" } });
    expect(p.json()).toEqual({ novas: 0, existentes: 1 });
  });

  it("expõe ranking e métricas", async () => {
    app = montar();
    expect((await app.inject({ method: "GET", url: "/api/ranking" })).json()).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/api/metricas" })).json().total).toBe(1);
  });
});

describe("POST /api/analises", () => {
  it("decodifica o arquivo em base64 e devolve o resultado da análise", async () => {
    const analisar = vi.fn(async () => RESULTADO_ANALISE);
    const casos = criarCasosDeUso({
      vagas: { listar: vi.fn(), obter: vi.fn(), registrar: vi.fn(), atualizarStatus: vi.fn() },
      ranking: { ranking: vi.fn(), metricas: vi.fn() },
      planilha: { exportar: vi.fn() },
      analise: { analisar },
    });
    app = criarApp(casos);
    const arquivo = Buffer.from("Eder: C#, RabbitMQ").toString("base64");
    const r = await app.inject({
      method: "POST", url: "/api/analises",
      payload: { nomeArquivo: "cv.txt", arquivoBase64: arquivo, requisitos: "C#\nRabbitMQ", modelo: "remoto" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().matchScore).toBe(64);
    const entrada = analisar.mock.calls[0]![0];
    expect(entrada.curriculo.toString()).toBe("Eder: C#, RabbitMQ");
    expect(entrada.modelo).toBe("remoto");
  });

  it("rejeita pedido sem arquivo ou com modelo inválido", async () => {
    app = criarApp(criarCasosDeUso({
      vagas: { listar: vi.fn(), obter: vi.fn(), registrar: vi.fn(), atualizarStatus: vi.fn() },
      ranking: { ranking: vi.fn(), metricas: vi.fn() },
      planilha: { exportar: vi.fn() },
      analise: { analisar: vi.fn() },
    }));
    const r = await app.inject({ method: "POST", url: "/api/analises", payload: { nomeArquivo: "cv.txt", modelo: "marciano" } });
    expect(r.statusCode).toBe(400);
  });
});
