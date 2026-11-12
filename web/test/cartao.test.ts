import { describe, expect, it } from "vitest";
import { montarCartao, textoCartao } from "../src/dominio/cartao";
import type { Metricas } from "../src/dominio/tipos";

const METRICAS: Metricas = {
  total: 10, enviadas: 6, chegaramEntrevista: 2, taxaConversao: 0.33, ofertas: 0, scoreMedio: 58,
  porStatus: [{ status: "entrevista", vagas: 2 }],
  faixas: [{ faixa: "80-100", enviadas: 3, entrevistas: 1 }],
  evolucao: [{ mes: "2026-02", analisadas: 10, enviadas: 6, entrevistas: 2 }],
  pontosFortes: [
    { nome: "Python", vagas: 7 }, { nome: "Docker", vagas: 4 }, { nome: "SQL Server", vagas: 3 },
    { nome: "AWS", vagas: 2 }, { nome: "Git", vagas: 2 }, { nome: "Vue.js", vagas: 1 },
  ],
  lacunas: [{ nome: "Kubernetes", vagas: 5 }],
};

describe("cartão de compartilhamento", () => {
  it("usa só agregados e limita os termos", () => {
    const c = montarCartao(METRICAS);
    expect(c.indicadores.find((i) => i.rotulo === "conversão em entrevista")?.valor).toBe("33%");
    expect(c.pontosFortes).toHaveLength(5);
    expect(c.pontosFortes[0]).toBe("Python");
    expect(c.lacunas).toEqual(["Kubernetes"]);
  });

  it("não contém empresa, link, id nem data completa", () => {
    const texto = textoCartao(montarCartao({ ...METRICAS }));
    expect(texto).not.toMatch(/https?:\/\//);
    expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(texto).not.toMatch(/Empresa|gupy\.io/i);
    expect(texto).toContain("Pontos fortes: Python");
  });
});
