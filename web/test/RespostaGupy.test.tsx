import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RespostaGupy } from "../src/apresentacao/componentes/RespostaGupy";

describe("RespostaGupy", () => {
  it("mostra o contador de caracteres em relação ao limite", () => {
    render(<RespostaGupy id="r" titulo="Sobre" valor="abc" aoMudar={() => {}} limite={1500} />);
    expect(screen.getByText("3 de 1500 caracteres")).toBeTruthy();
  });

  it("copia o texto para a área de transferência", async () => {
    const escrever = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText: escrever } });
    render(<RespostaGupy id="r" titulo="Sobre" valor="Olá" aoMudar={() => {}} limite={1500} />);
    await userEvent.click(screen.getByRole("button", { name: "Copiar" }));
    expect(escrever).toHaveBeenCalledWith("Olá");
    expect(await screen.findByText("Copiado")).toBeTruthy();
  });

  it("permite editar o texto", async () => {
    const mudou: string[] = [];
    render(<RespostaGupy id="r" titulo="Sobre" valor="" aoMudar={(v) => mudou.push(v)} multilinha />);
    await userEvent.type(screen.getByLabelText("Sobre"), "x");
    expect(mudou.at(-1)).toBe("x");
  });
});
