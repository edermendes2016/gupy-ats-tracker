import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AventuraPainel } from "../src/apresentacao/componentes/AventuraPainel";

const AVENTURA = {
  nivel: 2, titulo: "Currículo em Revisão", xp: 40, xpNivelAtual: 25, xpProximoNivel: 100,
  vagas: [{ id: "v1", empresa: "Acme", cargo: "Dev", xp: 40 }],
};

function renderizar(anonimo: boolean) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <AventuraPainel anonimo={anonimo} />
    </QueryClientProvider>,
  );
}

describe("AventuraPainel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(AVENTURA), { status: 200, headers: { "content-type": "application/json" } })));
  });

  it("mostra nível, título e a barra de XP", async () => {
    renderizar(false);
    expect(await screen.findByText("Nível 2")).toBeTruthy();
    expect(screen.getByText("Currículo em Revisão")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Progresso até o próximo nível" })).toBeTruthy();
  });

  it("no modo anônimo não mostra a lista de vagas nem o formulário", async () => {
    renderizar(true);
    await screen.findByText("Nível 2");
    expect(screen.queryByText("XP por vaga")).toBeNull();
    expect(screen.queryByText("Salvar progresso")).toBeNull();
  });

  it("lista as vagas que rendem XP quando não é anônimo", async () => {
    renderizar(false);
    await waitFor(() => expect(screen.getByText("40 XP")).toBeTruthy());
  });
});
