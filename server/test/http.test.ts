import path from "node:path";
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
      excluir: vi.fn(async () => undefined),
      ...sobrescrever,
    },
    ranking: {
      ranking: vi.fn(async () => [VAGA]),
      metricas: vi.fn(async () => ({ total: 1, enviadas: 0, chegaramEntrevista: 0, taxaConversao: 0 })),
    },
    planilha: { exportar: vi.fn(async () => ({ novas: 0, existentes: 1 })), gerarModelo: vi.fn(async () => undefined) },
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

describe("planilha: escolher e gerar", () => {
  function montarPlanilha(gerarModelo = vi.fn(async () => undefined), opcoes: Parameters<typeof criarApp>[1] = {}) {
    const casos = criarCasosDeUso({
      vagas: { listar: vi.fn(), obter: vi.fn(), registrar: vi.fn(), atualizarStatus: vi.fn(), excluir: vi.fn() },
      ranking: { ranking: vi.fn(), metricas: vi.fn() },
      planilha: { exportar: vi.fn(), gerarModelo },
      analise: { analisar: vi.fn() },
    });
    return { app: criarApp(casos, opcoes), gerarModelo };
  }

  it("sem seletor nativo, responde 501 para a interface pedir o caminho digitado", async () => {
    app = montar();
    const r = await app.inject({ method: "POST", url: "/api/planilha/escolher" });
    expect(r.statusCode).toBe(501);
  });

  it("sem seletor de pasta, responde 501 para a interface pedir a pasta digitada", async () => {
    app = montar();
    const r = await app.inject({ method: "POST", url: "/api/planilha/pasta/escolher" });
    expect(r.statusCode).toBe(501);
  });

  it("lista as planilhas da pasta configurada e responde 501 sem pasta configurada", async () => {
    app = montar();
    expect((await app.inject({ method: "GET", url: "/api/planilha/disponiveis" })).statusCode).toBe(501);
    const planilhasDisponiveis = vi.fn(async () => [{ nome: "controle.xlsx", caminho: "/app/planilhas/controle.xlsx" }]);
    const { app: a } = montarPlanilha(undefined, { planilhasDisponiveis });
    const r = await a.inject({ method: "GET", url: "/api/planilha/disponiveis" });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toEqual([{ nome: "controle.xlsx", caminho: "/app/planilhas/controle.xlsx" }]);
  });

  it("devolve a pasta escolhida no seletor, ou 204 se a pessoa cancelar", async () => {
    const escolherPasta = vi.fn(async () => "C:\\Docs")
      .mockResolvedValueOnce("C:\\Docs")
      .mockResolvedValueOnce(null);
    const { app: a } = montarPlanilha(undefined, { escolherPasta });
    const ok = await a.inject({ method: "POST", url: "/api/planilha/pasta/escolher" });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({ caminho: "C:\\Docs" });
    const cancelado = await a.inject({ method: "POST", url: "/api/planilha/pasta/escolher" });
    expect(cancelado.statusCode).toBe(204);
  });

  it("gera a planilha na pasta com o nome informado, acrescentando .xlsx", async () => {
    const { app: a, gerarModelo } = montarPlanilha();
    const r = await a.inject({ method: "POST", url: "/api/planilha/gerar", payload: { pasta: "docs", nome: "controle" } });
    expect(r.statusCode).toBe(201);
    const esperado = path.join("docs", "controle.xlsx");
    expect(gerarModelo).toHaveBeenCalledWith(esperado);
    expect(r.json()).toEqual({ caminho: esperado });
  });

  it("não duplica a extensão quando o nome já vem com .xlsx", async () => {
    const { app: a, gerarModelo } = montarPlanilha();
    await a.inject({ method: "POST", url: "/api/planilha/gerar", payload: { pasta: "docs", nome: "controle.xlsx" } });
    expect(gerarModelo).toHaveBeenCalledWith(path.join("docs", "controle.xlsx"));
  });

  it("recusa nome com separador de pasta com 400 e não cria nada", async () => {
    const { app: a, gerarModelo } = montarPlanilha();
    const r = await a.inject({ method: "POST", url: "/api/planilha/gerar", payload: { pasta: "docs", nome: "../x" } });
    expect(r.statusCode).toBe(400);
    expect(gerarModelo).not.toHaveBeenCalled();
  });

  it("recusa pasta vazia com 400", async () => {
    const { app: a, gerarModelo } = montarPlanilha();
    const r = await a.inject({ method: "POST", url: "/api/planilha/gerar", payload: { pasta: "", nome: "controle" } });
    expect(r.statusCode).toBe(400);
    expect(gerarModelo).not.toHaveBeenCalled();
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
