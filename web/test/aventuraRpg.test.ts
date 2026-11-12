import { describe, expect, it } from "vitest";
import { diarioDeBordo, geradoresDeXp, taxaPassiva, temBuffMatch, vagasNoFunil } from "../src/dominio/aventuraRpg";
import type { Missao, Vaga } from "../src/dominio/tipos";

const vaga = (id: string, status: Vaga["status"], matchScore = 50, empresa = "Empresa 01"): Vaga =>
  ({ id, status, matchScore, empresa, cargo: "Dev" }) as Vaga;

describe("aventuraRpg", () => {
  const vagas = [vaga("a", "analisada"), vaga("b", "candidatada", 75), vaga("c", "triagem", 40, "Empresa 02"), vaga("d", "recusada")];

  it("lista geradores, taxa passiva e funil", () => {
    expect(geradoresDeXp(vagas).map((v) => v.id)).toEqual(["a", "b", "c"]);
    expect(taxaPassiva(vagas)).toBe(1 + 2 + 3);
    expect(vagasNoFunil(vagas)).toBe(3);
  });

  it("dá buff a partir de 70%", () => {
    expect(temBuffMatch(vaga("x", "triagem", 70))).toBe(true);
    expect(temBuffMatch(vaga("x", "triagem", 69))).toBe(false);
  });

  it("monta o diário só com o nome recebido e no máximo 5 linhas", () => {
    const missoes = [{ id: "estudo", titulo: "Estudar uma lacuna", sugestao: "DDD", concluida: true }] as Missao[];
    const linhas = diarioDeBordo(vagas, missoes, 2, "Currículo em Revisão");
    expect(linhas.length).toBeLessThanOrEqual(5);
    expect(linhas[0]!.texto).toBe("✓ Missão cumprida: Estudar uma lacuna (DDD).");
    expect(linhas.some((l) => l.texto.includes("[Empresa 02]") && l.texto.includes("Triagem"))).toBe(true);
  });
});
