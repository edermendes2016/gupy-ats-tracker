import { describe, expect, it } from "vitest";
import { formatarData, tomDoScore } from "../src/dominio/score";

describe("tomDoScore", () => {
  it.each([
    [87, "alta"], [80, "alta"], [79, "boa"], [60, "boa"], [59, "aposta"], [40, "aposta"], [39, "descartar"], [0, "descartar"],
  ])("score %i -> %s", (score, tom) => {
    expect(tomDoScore(score)).toBe(tom);
  });
});

describe("formatarData", () => {
  it("converte AAAA-MM-DD para DD/MM/AAAA e deixa outros formatos intactos", () => {
    expect(formatarData("2026-01-10")).toBe("10/01/2026");
    expect(formatarData("2026-01")).toBe("2026-01");
  });
});
