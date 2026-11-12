import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AventuraPainel } from "../src/apresentacao/componentes/AventuraPainel";

const AVENTURA = {
  nivel: 2, titulo: "Currículo em Revisão", xp: 40, bonus: 0, xpNivelAtual: 25, xpProximoNivel: 100,
  vagas: [{ id: "v1", empresa: "Acme", cargo: "Dev", xp: 40 }],
};
const MISSOES = {
  dia: "2026-02-01",
  missoes: [
    { id: "candidaturas", titulo: "Candidatar-se a 3 vagas", descricao: "d", progresso: 1, meta: 3, concluida: false, sugestao: null, manual: false },
    { id: "estudo", titulo: "Estudar uma lacuna", descricao: "Hoje o alvo é Docker.", progresso: 0, meta: 1, concluida: false, sugestao: "Docker", manual: true },
    { id: "reforco", titulo: "Reforçar um ponto forte", descricao: "d", progresso: 0, meta: 1, concluida: false, sugestao: "C#", manual: true },
  ],
};
const resposta = (corpo: unknown) => new Response(JSON.stringify(corpo), { status: 200, headers: { "content-type": "application/json" } });

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
    vi.stubGlobal("fetch", vi.fn(async (url: string) => resposta(url.startsWith("/api/missoes") ? MISSOES : AVENTURA)));
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

  it("mostra as missões de hoje, com a sugestão das métricas", async () => {
    renderizar(false);
    expect(await screen.findByText("Estudar uma lacuna")).toBeTruthy();
    expect(screen.getByText("Hoje o alvo é Docker.")).toBeTruthy();
    expect(screen.getByText("1 de 3")).toBeTruthy();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });
});
