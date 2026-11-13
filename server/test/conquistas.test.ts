import { describe, expect, it } from "vitest";
import { calcularConquistas, DIAS_SEM_FEEDBACK, intervaloWilson, MINIMO_DESFECHOS_FAIXA } from "../src/dominio/conquistas.js";
import type { HistoricoItem, Status, Vaga } from "../src/dominio/vaga.js";

const base = (over: Partial<Vaga> = {}): Vaga => ({
  id: "v1", data: "2026-01-01", empresa: "Acme", cargo: "Dev Pleno", senioridade: "pleno", area: "dotnet",
  modelo: "remoto", status: "candidatada",
  criterios: { obrigatorios: 80, desejaveis: 50, experiencia: 70, dominio: 60, logistica: 90 },
  matchScore: 73, classificacao: "boa aderência", palavrasChave: [], lacunas: [],
  historico: [{ data: "2026-01-01", status: "candidatada" }],
  ...over,
});

const hist = (...itens: Array<[string, Status]>): HistoricoItem[] => itens.map(([data, status]) => ({ data, status }));

function porId(vagas: Vaga[], hoje = "2026-02-01", anonimo = false) {
  return Object.fromEntries(calcularConquistas(vagas, hoje, anonimo).map((c) => [c.id, c]));
}

describe("conquistas", () => {
  it("traz as oito conquistas, cada uma com frase de motivação", () => {
    const lista = calcularConquistas([], "2026-02-01");
    expect(lista.map((c) => c.id)).toEqual(["nao-passou-triagem", "silencio", "quase-la", "primeira-entrevista", "contratado", "calibracao-aposta", "calibracao-boa", "calibracao-alta"]);
    for (const c of lista) {
      expect(c.motivacao.length).toBeGreaterThan(10);
      expect(c.desbloqueada).toBe(false);
    }
  });

  it("não passou da triagem: recusada sem teste, entrevista ou oferta", () => {
    const vagas = [base({ status: "recusada", historico: hist(["2026-01-01", "candidatada"], ["2026-01-03", "triagem"], ["2026-01-05", "recusada"]) })];
    expect(porId(vagas)["nao-passou-triagem"]?.desbloqueada).toBe(true);
  });

  it("recusada depois de entrevista não conta como triagem", () => {
    const vagas = [base({ status: "recusada", historico: hist(["2026-01-01", "candidatada"], ["2026-01-03", "entrevista"], ["2026-01-05", "recusada"]) })];
    expect(porId(vagas)["nao-passou-triagem"]?.desbloqueada).toBe(false);
  });

  it("silêncio: desbloqueia com dias de espera a partir do limite e cita a empresa fora do anônimo", () => {
    const vagas = [base({ data: "2026-01-01", historico: hist(["2026-01-01", "candidatada"]) })];
    const dias = 31; // de 1 de janeiro a 1 de fevereiro
    expect(dias).toBeGreaterThanOrEqual(DIAS_SEM_FEEDBACK);
    const c = porId(vagas)["silencio"];
    expect(c?.desbloqueada).toBe(true);
    expect(c?.detalhe).toBe("Acme: 31 dias sem resposta");
  });

  it("silêncio abaixo do limite fica bloqueado, mas mostra o andamento", () => {
    const vagas = [base({ historico: hist(["2026-01-25", "candidatada"]) })];
    const c = porId(vagas, "2026-02-01")["silencio"];
    expect(c?.desbloqueada).toBe(false);
    expect(c?.detalhe).toBe("Acme: 7 dias sem resposta");
  });

  it("silêncio conta a partir da última mudança de etapa", () => {
    const vagas = [base({ status: "triagem", historico: hist(["2026-01-01", "candidatada"], ["2026-01-28", "triagem"]) })];
    expect(porId(vagas, "2026-02-01")["silencio"]?.detalhe).toBe("Acme: 4 dias sem resposta");
  });

  it("silêncio ignora vagas que já tiveram resposta final", () => {
    const vagas = [base({ status: "recusada", historico: hist(["2026-01-01", "candidatada"]) })];
    const c = porId(vagas)["silencio"];
    expect(c?.desbloqueada).toBe(false);
    expect(c?.detalhe).toBeNull();
  });

  it("no modo anônimo o silêncio mostra só os dias, sem empresa", () => {
    const vagas = [base({ historico: hist(["2026-01-01", "candidatada"]) })];
    const c = porId(vagas, "2026-02-01", true)["silencio"];
    expect(c?.detalhe).toBe("31 dias sem resposta");
    expect(c?.detalhe).not.toContain("Acme");
  });

  it("quase chegou lá: chegou à entrevista e terminou sem oferta", () => {
    const vagas = [base({ status: "desistencia", historico: hist(["2026-01-01", "candidatada"], ["2026-01-10", "entrevista"], ["2026-01-12", "desistencia"]) })];
    expect(porId(vagas)["quase-la"]?.desbloqueada).toBe(true);
  });

  it("quase chegou lá não vale para entrevista ainda em andamento", () => {
    const vagas = [base({ status: "entrevista", historico: hist(["2026-01-01", "candidatada"], ["2026-01-10", "entrevista"]) })];
    expect(porId(vagas)["quase-la"]?.desbloqueada).toBe(false);
  });

  it("primeira entrevista vale para qualquer vaga que chegou à entrevista", () => {
    const vagas = [base({ status: "candidatada" }), base({ id: "v2", status: "entrevista", historico: hist(["2026-01-10", "entrevista"]) })];
    expect(porId(vagas)["primeira-entrevista"]?.desbloqueada).toBe(true);
  });

  it("contratado: chegou à oferta, mesmo que a vaga tenha mudado depois", () => {
    const vagas = [base({ status: "recusada", historico: hist(["2026-01-01", "candidatada"], ["2026-01-05", "oferta"], ["2026-01-09", "recusada"]) })];
    expect(porId(vagas)["contratado"]?.desbloqueada).toBe(true);
  });

  it("no modo anônimo nenhum texto cita empresa ou cargo", () => {
    const vagas = [base({ status: "recusada", historico: hist(["2026-01-01", "candidatada"], ["2026-01-05", "recusada"]) })];
    for (const c of calcularConquistas(vagas, "2026-02-01", true)) {
      const texto = [c.titulo, c.requisito, c.motivacao, c.detalhe ?? ""].join(" ");
      expect(texto).not.toContain("Acme");
      expect(texto).not.toContain("Dev Pleno");
    }
  });
  it("wilson: intervalo de 95% para 4 de 12 e casos extremos", () => {
    expect(intervaloWilson(4, 12)).toEqual({ inferior: 14, superior: 61 });
    expect(intervaloWilson(0, 10).inferior).toBe(0);
    expect(intervaloWilson(10, 10).superior).toBe(100);
  });

  it("calibração: abaixo do mínimo de desfechos, fica bloqueada com 'poucos dados ainda'", () => {
    const vagas = Array.from({ length: MINIMO_DESFECHOS_FAIXA - 1 }, (_, i) =>
      base({ id: `v${i}`, matchScore: 85, status: "recusada", historico: hist(["2026-01-01", "candidatada"], ["2026-01-05", "recusada"]) }),
    );
    const c = porId(vagas)["calibracao-alta"];
    expect(c?.desbloqueada).toBe(false);
    expect(c?.detalhe).toBe("Poucos dados ainda: 9 de 10 desfechos");
    expect(c?.requisito).toContain("80 a 100");
  });

  it("calibração: no mínimo de desfechos libera a faixa e mostra a taxa com Wilson", () => {
    const recusadas = Array.from({ length: 6 }, (_, i) =>
      base({ id: `r${i}`, matchScore: 65, status: "recusada", historico: hist(["2026-01-01", "candidatada"], ["2026-01-05", "recusada"]) }),
    );
    const entrevistas = Array.from({ length: 4 }, (_, i) =>
      base({ id: `e${i}`, matchScore: 70, status: "entrevista", historico: hist(["2026-01-01", "candidatada"], ["2026-01-05", "entrevista"]) }),
    );
    const c = porId([...recusadas, ...entrevistas])["calibracao-boa"];
    expect(c?.desbloqueada).toBe(true);
    expect(c?.detalhe).toBe("4 de 10 viraram entrevista (40%, IC 95%: 17% a 69%)");
  });

  it("calibração: vaga em andamento sem entrevista não conta como desfecho", () => {
    const vagas = Array.from({ length: 12 }, (_, i) => base({ id: `t${i}`, matchScore: 90, status: "triagem" }));
    const c = porId(vagas)["calibracao-alta"];
    expect(c?.desbloqueada).toBe(false);
    expect(c?.detalhe).toBe("Poucos dados ainda: 0 de 10 desfechos");
  });

  it("calibração: cada faixa conta só as vagas com o próprio score", () => {
    const vagas = Array.from({ length: 10 }, (_, i) =>
      base({ id: `a${i}`, matchScore: 45, status: "desistencia", historico: hist(["2026-01-01", "candidatada"], ["2026-01-05", "desistencia"]) }),
    );
    const lista = porId(vagas);
    expect(lista["calibracao-aposta"]?.desbloqueada).toBe(true);
    expect(lista["calibracao-boa"]?.desbloqueada).toBe(false);
    expect(lista["calibracao-alta"]?.desbloqueada).toBe(false);
  });

  it("no modo anônimo as conquistas de calibração não citam empresa", () => {
    const vagas = Array.from({ length: 10 }, (_, i) =>
      base({ id: `x${i}`, matchScore: 75, status: "recusada", historico: hist(["2026-01-01", "candidatada"], ["2026-01-05", "recusada"]) }),
    );
    const c = calcularConquistas(vagas, "2026-02-01", true).find((x) => x.id === "calibracao-boa");
    expect(c?.desbloqueada).toBe(true);
    expect(JSON.stringify(c)).not.toContain("Acme");
  });
});
