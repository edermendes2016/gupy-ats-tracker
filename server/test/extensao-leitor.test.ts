import { describe, expect, it } from "vitest";
// @ts-expect-error: módulo JS puro da extensão, sem tipos
import { extrairProgresso, lerCartao } from "../../extensao/leitor.js";

describe("extensão: leitura dos cards", () => {
  it("extrai X/Y de 'Seu Progresso'", () => {
    expect(extrairProgresso("Seu Progresso\n1/7")).toEqual({ atual: 1, total: 7 });
    expect(extrairProgresso("Seu Progresso 2 / 8")).toEqual({ atual: 2, total: 8 });
  });

  it("recusa progresso impossível ou ausente", () => {
    expect(extrairProgresso("Seu Progresso 9/8")).toBeNull();
    expect(extrairProgresso("nada aqui")).toBeNull();
  });

  it("lê empresa, cargo e progresso do texto do card", () => {
    const texto = "FCamara\nDesenvolvedor FullStack .Net/React Sênior\nNão informado\nRemoto\nSeu Progresso\n1/7\nDesistir\nVer andamento";
    expect(lerCartao(texto)).toEqual({
      empresa: "FCamara",
      cargo: "Desenvolvedor FullStack .Net/React Sênior",
      atual: 1,
      total: 7,
    });
  });

  it("descarta card sem nome de empresa e cargo", () => {
    expect(lerCartao("Seu Progresso\n1/7")).toBeNull();
  });
});
