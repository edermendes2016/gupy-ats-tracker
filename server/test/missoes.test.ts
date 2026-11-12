import { describe, expect, it } from "vitest";
import { candidaturasNoDia, META_CANDIDATURAS, missoesConcluidas, missoesDoDia } from "../src/dominio/missoes.js";
import { xpBonus, TETO_XP_BONUS, XP_BONUS_CONQUISTA, XP_BONUS_MISSAO } from "../src/dominio/aventura.js";
import type { HistoricoItem, Vaga } from "../src/dominio/vaga.js";

const base = (over: Partial<Vaga> = {}): Vaga => ({
  id: "v1", data: "2026-02-01", empresa: "Acme", cargo: "Dev Pleno", senioridade: "pleno", area: "dotnet",
  modelo: "remoto", status: "candidatada",
  criterios: { obrigatorios: 80, desejaveis: 50, experiencia: 70, dominio: 60, logistica: 90 },
  matchScore: 73, classificacao: "boa aderência", palavrasChave: [], lacunas: [],
  historico: [{ data: "2026-02-01", status: "candidatada" }],
  ...over,
});
const cand = (data: string): HistoricoItem[] => [{ data, status: "candidatada" }];
const TERMOS = {
  pontosFortes: [{ nome: "C#", vagas: 5 }, { nome: "Python", vagas: 3 }],
  lacunas: [{ nome: "Kubernetes", vagas: 4 }, { nome: "RabbitMQ", vagas: 2 }],
};

describe("candidaturas do dia", () => {
  it("conta vagas candidatadas naquele dia, sem repetir a mesma vaga", () => {
    const vagas = [
      base({ id: "a", historico: [...cand("2026-02-01"), { data: "2026-02-03", status: "triagem" }] }),
      base({ id: "b", historico: cand("2026-02-01") }),
      base({ id: "c", historico: cand("2026-01-30") }),
      base({ id: "d", data: "2026-02-01", historico: [] }), // sem histórico: vale a data de cadastro
    ];
    expect(candidaturasNoDia(vagas, "2026-02-01")).toBe(3);
  });
});

describe("missoes do dia", () => {
  it("candidaturas: progresso até a meta e concluída ao atingir 3", () => {
    const vagas = [base({ id: "a" }), base({ id: "b" })];
    const [cands] = missoesDoDia("2026-02-01", vagas, undefined, TERMOS);
    expect(cands).toMatchObject({ id: "candidaturas", progresso: 2, meta: META_CANDIDATURAS, concluida: false, manual: false });
    const vagas3 = [...vagas, base({ id: "c" }), base({ id: "d" })];
    expect(missoesDoDia("2026-02-01", vagas3, undefined, TERMOS)[0]).toMatchObject({ progresso: 3, concluida: true });
  });

  it("estudo e reforço usam os termos das métricas e são marcados à mão", () => {
    const [, estudo, reforco] = missoesDoDia("2026-02-01", [], { estudo: true }, TERMOS);
    expect(estudo).toMatchObject({ id: "estudo", manual: true, concluida: true, progresso: 1 });
    expect(estudo?.sugestao).toBeTruthy();
    expect(TERMOS.lacunas.map((t) => t.nome)).toContain(estudo?.sugestao);
    expect(reforco).toMatchObject({ id: "reforco", manual: true, concluida: false, progresso: 0 });
    expect(TERMOS.pontosFortes.map((t) => t.nome)).toContain(reforco?.sugestao);
  });

  it("sem métricas, as missões manuais seguem sem sugestão", () => {
    const [, estudo, reforco] = missoesDoDia("2026-02-01", [], undefined, { pontosFortes: [], lacunas: [] });
    expect(estudo?.sugestao).toBeNull();
    expect(reforco?.sugestao).toBeNull();
    expect(estudo?.descricao).toContain("Ainda não há lacunas");
  });

  it("a sugestão é a mesma no mesmo dia e muda com o dia", () => {
    const a = missoesDoDia("2026-02-01", [], undefined, TERMOS)[1]?.sugestao;
    expect(missoesDoDia("2026-02-01", [], undefined, TERMOS)[1]?.sugestao).toBe(a);
    const dias = ["2026-02-01", "2026-02-02"].map((d) => missoesDoDia(d, [], undefined, TERMOS)[1]?.sugestao);
    expect(dias[0]).not.toBe(dias[1]);
  });
});

describe("missões concluídas e bônus de XP", () => {
  it("conta dias com 3 candidaturas e marcações feitas, em toda a história", () => {
    const vagas = [
      base({ id: "a", historico: cand("2026-02-01") }),
      base({ id: "b", historico: cand("2026-02-01") }),
      base({ id: "c", historico: cand("2026-02-01") }),
      base({ id: "d", historico: cand("2026-02-02") }), // só uma no dia 2: não conta
    ];
    const registros = { "2026-02-01": { estudo: true, reforco: false }, "2026-02-02": { reforco: true } };
    expect(missoesConcluidas(vagas, registros)).toBe(1 + 1 + 1);
  });

  it("o bônus soma conquistas e missões e respeita o teto", () => {
    expect(xpBonus(1, 2)).toBe(XP_BONUS_CONQUISTA + 2 * XP_BONUS_MISSAO);
    expect(xpBonus(0, 0)).toBe(0);
    expect(xpBonus(100, 100)).toBe(TETO_XP_BONUS);
  });
});
