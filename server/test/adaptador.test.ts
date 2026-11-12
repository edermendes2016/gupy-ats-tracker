import { describe, expect, it } from "vitest";
import { metricasDoProto, novaVagaParaProto, semPrefixo, vagaDoProto } from "../src/infraestrutura/grpc/adaptador.js";

describe("adaptador gRPC", () => {
  it("remove o prefixo do enum e normaliza para minúsculas", () => {
    expect(semPrefixo("STATUS_ENTREVISTA", "STATUS")).toBe("entrevista");
    expect(semPrefixo("MODELO_NAO_INFORMADO", "MODELO")).toBe("nao_informado");
  });

  it("converte a vaga do proto para o domínio e trata modelo não informado", () => {
    const vaga = vagaDoProto({
      id: "a", data: "2026-01-10", empresa: "Acme", cargo: "Dev",
      senioridade: "SENIORIDADE_PLENO", area: "dotnet", modelo: "MODELO_NAO_INFORMADO",
      url: "", status: "STATUS_TRIAGEM",
      criterios: { obrigatorios: 80, desejaveis: 50, experiencia: 70, dominio: 60, logistica: 90 },
      match_score: 73, classificacao: "boa aderência",
      palavras_chave: ["dotnet"], lacunas: [], historico: [{ data: "2026-01-10", status: "STATUS_TRIAGEM" }],
      descricao: "",
    });
    expect(vaga.status).toBe("triagem");
    expect(vaga.senioridade).toBe("pleno");
    expect(vaga.modelo).toBeNull();
    expect(vaga.matchScore).toBe(73);
    expect(vaga.url).toBeUndefined();
    expect(vaga.descricao).toBeUndefined();
  });

  it("monta RegistrarVagaRequest omitindo campos indefinidos", () => {
    const req = novaVagaParaProto({
      data: "2026-01-10", empresa: "Acme", cargo: "Dev", senioridade: "junior", area: "outra",
      modelo: "hibrido", status: "candidatada",
      criterios: { obrigatorios: 1, desejaveis: 1, experiencia: 1, dominio: 1, logistica: 1 },
      palavrasChave: ["x"], lacunas: [],
    });
    expect(req.vaga.modelo).toBe("MODELO_HIBRIDO");
    expect(req.vaga.status).toBe("STATUS_CANDIDATADA");
    expect("descricao" in req.vaga).toBe(false);
  });

  it("converte métricas", () => {
    expect(metricasDoProto({ total: 4, enviadas: 2, chegaram_entrevista: 1, taxa_conversao: 0.5 })).toEqual({
      total: 4, enviadas: 2, chegaramEntrevista: 1, taxaConversao: 0.5,
    });
  });
});
