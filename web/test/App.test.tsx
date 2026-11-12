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

const METRICAS = {
  total: 4, enviadas: 3, chegaramEntrevista: 1, taxaConversao: 0.33, ofertas: 0, scoreMedio: 61,
  porStatus: [{ status: "entrevista", vagas: 1 }],
  faixas: [{ faixa: "80-100", enviadas: 2, entrevistas: 1 }],
  evolucao: [{ mes: "2026-02", analisadas: 4, enviadas: 3, entrevistas: 1 }],
  pontosFortes: [{ nome: "Python", vagas: 3 }],
  lacunas: [{ nome: "Kubernetes", vagas: 2 }],
};

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
        ? METRICAS
        : [VAGA];
      return new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
    }));
    renderizar();
    await userEvent.click(screen.getByRole("tab", { name: "Métricas" }));
    expect(await screen.findByText("vagas analisadas")).toBeTruthy();
    expect(screen.getByText("33%")).toBeTruthy();
    expect(screen.getByText("Python")).toBeTruthy();
    expect(screen.getByText("Kubernetes")).toBeTruthy();
  });

  it("mostra Compartilhar na aba Métricas, desabilitado fora do modo anônimo", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const corpo = url.includes("/api/metricas") ? METRICAS : [VAGA];
      return new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
    }));
    renderizar();
    await userEvent.click(screen.getByRole("tab", { name: "Métricas" }));
    await screen.findByText("vagas analisadas");
    expect(screen.getByRole("heading", { name: "Compartilhar" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Gerar imagem" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/ative o modo anônimo/i)).toBeTruthy();
  });

  it("habilita Compartilhar quando o modo anônimo está marcado", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      const corpo = url.includes("/api/metricas") ? METRICAS : [VAGA];
      return new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });
    }));
    renderizar();
    await userEvent.click(screen.getByRole("tab", { name: "Métricas" }));
    await screen.findByText("vagas analisadas");
    await userEvent.click(screen.getByLabelText(/modo anônimo/i));
    expect((screen.getByRole("button", { name: "Gerar imagem" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("modo anônimo", () => {
  it("não oferece detalhe da vaga, porque o id mascarado não existe no serviço", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify([VAGA]), { status: 200, headers: { "content-type": "application/json" } })));
    renderizar();
    await screen.findByRole("table");
    await userEvent.click(screen.getByLabelText(/modo anônimo/i));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Acme" })).toBeNull());
  });

  it("exclui pelo ranking só depois de confirmar, e no modo anônimo usa o id mascarado", async () => {
    const chamadasDelete: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        chamadasDelete.push(url);
        return new Response(null, { status: 204 });
      }
      return new Response(JSON.stringify([VAGA]), { status: 200, headers: { "content-type": "application/json" } });
    }));
    renderizar();
    const tabela = await screen.findByRole("table");
    await userEvent.click(within(tabela).getByRole("button", { name: /Excluir Acme/ }));
    expect(chamadasDelete).toHaveLength(0);
    await userEvent.click(within(tabela).getByRole("button", { name: "Confirmar exclusão" }));
    await waitFor(() => expect(chamadasDelete).toHaveLength(1));
    expect(chamadasDelete[0]).toBe(`/api/vagas/${encodeURIComponent(VAGA.id)}`);
  });
});
