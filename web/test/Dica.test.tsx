import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dica } from "../src/apresentacao/componentes/Dica";

describe("Dica", () => {
  it("abre e fecha a explicação pelo botão e pelo Esc", async () => {
    render(<Dica id="d1" rotulo="Desejáveis" texto="Quanto dos diferenciais você cobre." />);
    const botao = screen.getByRole("button", { name: "Ajuda: Desejáveis" });
    expect(botao.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(botao);
    expect(botao.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("note").textContent).toContain("diferenciais");
    await userEvent.keyboard("{Escape}");
    expect(botao.getAttribute("aria-expanded")).toBe("false");
  });

  it("abre pelo teclado (Enter)", async () => {
    render(<Dica id="d2" rotulo="Logística" texto="Modelo e local." />);
    screen.getByRole("button", { name: "Ajuda: Logística" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Ajuda: Logística" }).getAttribute("aria-expanded")).toBe("true");
  });
});
