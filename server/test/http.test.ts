import { afterEach, describe, expect, it, vi } from "vitest";
import { criarCasosDeUso } from "../src/aplicacao/casos.js";
import { ErroConflito, ErroEntradaInvalida, ErroNaoEncontrada } from "../src/aplicacao/erros.js";
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
      excluir: vi.fn(async () => undefined),
      ...sobrescrever,
    },
    ranking: {
      ranking: vi.fn(async () => [VAGA]),
      metricas: vi.fn(async () => ({ total: 1, enviadas: 0, chegaramEntrevista: 0, taxaConversao: 0 })),
    },
    planilha: { modelo: vi.fn(), atualizar: vi.fn() },
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

  it("atualiza status da vaga", async () => {
    app = montar();
    const s = await app.inject({ method: "PATCH", url: "/api/vagas/v1/status", payload: { status: "oferta" } });
    expect(s.statusCode).toBe(200);
  });

  it("expõe ranking e métricas", async () => {
    app = montar();
    expect((await app.inject({ method: "GET", url: "/api/ranking" })).json()).toHaveLength(1);
    expect((await app.inject({ method: "GET", url: "/api/metricas" })).json().total).toBe(1);
  });
});

describe("DELETE /api/vagas/:id", () => {
  it("aceita Content-Type JSON com corpo vazio (regressão: 'Body cannot be empty')", async () => {
    const excluir = vi.fn(async () => undefined);
    app = montar({ excluir });
    const r = await app.inject({
      method: "DELETE",
      url: "/api/vagas/x?anonimo=false",
      headers: { "content-type": "application/json" },
    });
    expect(r.statusCode).toBe(204);
    expect(excluir).toHaveBeenCalledWith("x", false);
  });

  it("responde 204 e repassa o modo anônimo à aplicação", async () => {
    const excluir = vi.fn(async () => undefined);
    app = montar({ excluir });
    const r = await app.inject({ method: "DELETE", url: "/api/vagas/empresa-01-2026-04?anonimo=true" });
    expect(r.statusCode).toBe(204);
    expect(excluir).toHaveBeenCalledWith("empresa-01-2026-04", true);
  });
});

describe("planilha: baixar modelo e enviar planilha preenchida", () => {
  function montarPlanilha(planilha: Partial<Parameters<typeof criarCasosDeUso>[0]["planilha"]> = {}) {
    const casos = criarCasosDeUso({
      vagas: { listar: vi.fn(), obter: vi.fn(), registrar: vi.fn(), atualizarStatus: vi.fn(), excluir: vi.fn() },
      ranking: { ranking: vi.fn(), metricas: vi.fn() },
      planilha: {
        modelo: vi.fn(async () => Buffer.from("MODELO")),
        atualizar: vi.fn(async () => ({ conteudo: Buffer.from("ATUALIZADA"), novas: 2, existentes: 1 })),
        ...planilha,
      },
      analise: { analisar: vi.fn() },
    });
    return { app: criarApp(casos) };
  }

  it("entrega o modelo em branco como download .xlsx", async () => {
    const { app: a } = montarPlanilha();
    const r = await a.inject({ method: "GET", url: "/api/planilha/modelo" });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("spreadsheetml.sheet");
    expect(r.headers["content-disposition"]).toContain("modelo-planilha-controle.xlsx");
    expect(r.rawPayload.toString()).toBe("MODELO");
  });

  it("recebe a planilha em base64, acrescenta as vagas e devolve a atualizada", async () => {
    const atualizar = vi.fn(async (_c: Buffer) => ({ conteudo: Buffer.from("ATUALIZADA"), novas: 2, existentes: 1 }));
    const { app: a } = montarPlanilha({ atualizar });
    const r = await a.inject({
      method: "POST",
      url: "/api/planilha/atualizar",
      payload: { arquivoBase64: Buffer.from("ENVIADA").toString("base64") },
    });
    expect(r.statusCode).toBe(200);
    expect(atualizar.mock.calls[0][0].toString()).toBe("ENVIADA");
    expect(r.json()).toEqual({ novas: 2, existentes: 1, arquivoBase64: Buffer.from("ATUALIZADA").toString("base64") });
  });

  it("recusa arquivo vazio com 400 sem chamar o serviço", async () => {
    const atualizar = vi.fn();
    const { app: a } = montarPlanilha({ atualizar });
    const r = await a.inject({ method: "POST", url: "/api/planilha/atualizar", payload: { arquivoBase64: "" } });
    expect(r.statusCode).toBe(400);
    expect(atualizar).not.toHaveBeenCalled();
  });

  it("recusa arquivo maior que 5 MB com 400", async () => {
    const atualizar = vi.fn();
    const { app: a } = montarPlanilha({ atualizar });
    const grande = Buffer.alloc(5 * 1024 * 1024 + 1, 1).toString("base64");
    const r = await a.inject({ method: "POST", url: "/api/planilha/atualizar", payload: { arquivoBase64: grande } });
    expect(r.statusCode).toBe(400);
    expect(atualizar).not.toHaveBeenCalled();
  });

  it("repassa a recusa do serviço (arquivo que não é o modelo) como 400", async () => {
    const atualizar = vi.fn(async () => { throw new ErroEntradaInvalida("esta planilha não é o modelo de controle"); });
    const { app: a } = montarPlanilha({ atualizar });
    const r = await a.inject({
      method: "POST",
      url: "/api/planilha/atualizar",
      payload: { arquivoBase64: Buffer.from("x").toString("base64") },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toContain("não é o modelo de controle");
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
