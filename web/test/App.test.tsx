import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "../src/apresentacao/App";

const VAGA = {
  id: "2026-01-10-acme-dev", data: "2026-01-10", empresa: "Acme", cargo: "Dev Pleno",
  senioridade: "pleno", area: "dotnet", modelo: "remoto", status: "analisada",
  criterios: { obrigatorios: 80, desejaveis: 50, experiencia: 70, dominio: 60, logistica: 90 },
  matchScore: 73, classificacao: "boa aderência", palavrasChave: [], lacunas: [], historico: [],
};

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <App />
    </QueryClientProvider>,
  );
}

describe("App", () => {
  let chamadas: string[];

  beforeEach(() => {
    chamadas = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      chamadas.push(url);
      return new Response(JSON.stringify([VAGA]), { status: 200, headers: { "content-type": "application/json" } });
    }));
  });

  it("mostra o ranking com score e empresa", async () => {
    renderizar();
    const tabela = await screen.findByRole("table");
    expect(within(tabela).getByText("Acme")).toBeTruthy();
    expect(within(tabela).getByText("73%")).toBeTruthy();
  });

  it("no modo anônimo, pede o ranking com anonimo=true", async () => {
    renderizar();
    await screen.findByRole("table");
    await userEvent.click(screen.getByLabelText(/modo anônimo/i));
    await waitFor(() => expect(chamadas.some((u) => u === "/api/ranking?anonimo=true")).toBe(true));
  });

  it("troca de aba para Métricas", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const corpo = url.includes("/api/metricas")
        ? { total: 4, enviadas: 3, chegaramEntrevista: 1, taxaConversao: 0.33 }
        : [VAGA];
      return new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
    }));
    renderizar();
    await userEvent.click(screen.getByRole("tab", { name: "Métricas" }));
    expect(await screen.findByText("vagas analisadas")).toBeTruthy();
    expect(screen.getByText("33%")).toBeTruthy();
  });
});
