import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConquistasPainel } from "../src/apresentacao/componentes/ConquistasPainel";

const CONQUISTAS = [
  { id: "nao-passou-triagem", titulo: "Não passou da triagem", requisito: "r", motivacao: "Frase um.", desbloqueada: true, detalhe: null },
  { id: "silencio", titulo: "Empresa sem feedback há mais tempo", requisito: "r", motivacao: "Frase dois.", desbloqueada: false, detalhe: "31 dias sem resposta" },
  { id: "contratado", titulo: "Contratado", requisito: "r", motivacao: "Frase três.", desbloqueada: false, detalhe: null },
];

function renderizar(anonimo: boolean) {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <ConquistasPainel anonimo={anonimo} />
    </QueryClientProvider>,
  );
}

describe("ConquistasPainel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(CONQUISTAS), { status: 200, headers: { "content-type": "application/json" } })));
  });

  it("mostra as conquistas, a contagem e a frase de motivação de cada uma", async () => {
    renderizar(false);
    expect(await screen.findByText("Não passou da triagem")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText(/de 3 desbloqueadas/)).toBeTruthy();
    expect(screen.getByText("“Frase um.”")).toBeTruthy();
    expect(screen.getByText("“Frase dois.”")).toBeTruthy();
    expect(screen.getByText("“Frase três.”")).toBeTruthy();
  });

  it("marca desbloqueadas e bloqueadas também com texto, não só cor", async () => {
    renderizar(false);
    await screen.findByText("Não passou da triagem");
    expect(screen.getAllByText("Bloqueada")).toHaveLength(2);
    expect(screen.getAllByText("Desbloqueada")).toHaveLength(1);
  });

  it("pede o modo que o usuário escolheu na consulta", async () => {
    renderizar(true);
    await waitFor(() => expect(screen.getByText("Contratado")).toBeTruthy());
    const url = String((vi.mocked(fetch).mock.calls[0] as unknown[])[0]);
    expect(url).toBe("/api/conquistas?anonimo=true");
  });
});
