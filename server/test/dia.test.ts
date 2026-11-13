import { afterEach, describe, expect, it, vi } from "vitest";
import { diaDeHoje, FUSO_DO_APP } from "../src/dominio/dia.js";
import { criarCasosDeUso } from "../src/aplicacao/casos.js";

describe("dia de hoje no fuso de São Paulo", () => {
  it("usa o fuso de São Paulo, não UTC", () => {
    expect(FUSO_DO_APP).toBe("America/Sao_Paulo");
  });

  it("à noite em Brasília (depois das 21h), ainda é o dia anterior em UTC", () => {
    // 2026-11-13 01:30 UTC = 2026-11-12 22:30 em Brasília
    expect(diaDeHoje(new Date("2026-11-13T01:30:00Z"))).toBe("2026-11-12");
  });

  it("a virada do dia acontece à meia-noite de Brasília (03:00 UTC)", () => {
    expect(diaDeHoje(new Date("2026-11-13T02:59:59Z"))).toBe("2026-11-12");
    expect(diaDeHoje(new Date("2026-11-13T03:00:00Z"))).toBe("2026-11-13");
  });

  it("de manhã cedo, UTC e Brasília coincidem", () => {
    expect(diaDeHoje(new Date("2026-11-13T12:04:09Z"))).toBe("2026-11-13");
  });

  it("devolve sempre AAAA-MM-DD", () => {
    expect(diaDeHoje(new Date("2026-01-05T15:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("casos de uso sem data injetada", () => {
  afterEach(() => vi.useRealTimers());

  it("as missões de hoje usam o dia de Brasília na virada da noite", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-13T01:30:00Z"));
    const casos = criarCasosDeUso({
      vagas: { listar: async () => [] } as never,
      ranking: { metricas: async () => ({ pontosFortes: [], lacunas: [] }) } as never,
      planilha: {} as never,
      analise: {} as never,
    });
    expect((await casos.missoes()).dia).toBe("2026-11-12");
  });
});
