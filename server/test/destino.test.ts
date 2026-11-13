import path from "node:path";
import { describe, expect, it } from "vitest";
import { montarCaminhoXlsx } from "../src/aplicacao/destino.js";
import { ErroEntradaInvalida } from "../src/aplicacao/erros.js";

const PASTA = path.join("pasta", "planilhas");

describe("montarCaminhoXlsx", () => {
  it("acrescenta .xlsx ao nome digitado sem extensão", () => {
    expect(montarCaminhoXlsx(PASTA, "controle")).toBe(path.join(PASTA, "controle.xlsx"));
  });

  it("não duplica a extensão se a pessoa já a digitou, em qualquer caixa", () => {
    expect(montarCaminhoXlsx(PASTA, "controle.xlsx")).toBe(path.join(PASTA, "controle.xlsx"));
    expect(montarCaminhoXlsx(PASTA, "Controle.XLSX")).toBe(path.join(PASTA, "Controle.xlsx"));
  });

  it("aceita espaços e acentos e tira espaços das pontas", () => {
    expect(montarCaminhoXlsx(` ${PASTA} `, "  Planilha de controle 2026 ")).toBe(
      path.join(PASTA, "Planilha de controle 2026.xlsx"),
    );
  });

  it("recusa pasta vazia e nome vazio", () => {
    expect(() => montarCaminhoXlsx("  ", "controle")).toThrow(ErroEntradaInvalida);
    expect(() => montarCaminhoXlsx(PASTA, "   ")).toThrow(ErroEntradaInvalida);
    expect(() => montarCaminhoXlsx(PASTA, ".xlsx")).toThrow(ErroEntradaInvalida);
  });

  it("recusa separadores de pasta no nome, o que impede escapar da pasta escolhida", () => {
    for (const nome of ["../fora", "sub/controle", "sub\\controle", "..\\..\\x", "/etc/passwd"]) {
      expect(() => montarCaminhoXlsx(PASTA, nome)).toThrow(ErroEntradaInvalida);
    }
  });

  it("recusa caracteres proibidos, nomes especiais e nomes reservados do Windows", () => {
    for (const nome of ["a:b", "a*b", "a?b", 'a"b', "a<b", "a>b", "a|b", "a\u0001b", ".", "..", "controle.", "CON", "lpt1"]) {
      expect(() => montarCaminhoXlsx(PASTA, nome)).toThrow(ErroEntradaInvalida);
    }
  });

  it("recusa nomes longos demais", () => {
    expect(() => montarCaminhoXlsx(PASTA, "a".repeat(121))).toThrow(ErroEntradaInvalida);
  });
});
