import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExportarPlanilha } from "../src/apresentacao/componentes/ExportarPlanilha";

function renderizar() {
  const cliente = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <ExportarPlanilha />
    </QueryClientProvider>,
  );
}

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
}

const inputArquivo = (c: HTMLElement) => c.querySelector('input[type="file"]') as HTMLInputElement;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:planilha-atualizada");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.unstubAllGlobals());

describe("planilha de controle", () => {
  it("oferece o download do modelo e não pede caminho nenhum", () => {
    renderizar();
    const baixar = screen.getByRole("link", { name: "Baixar modelo" });
    expect(baixar.getAttribute("href")).toBe("/api/planilha/modelo");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("mostra o tutorial ao clicar no botão", async () => {
    renderizar();
    const botao = screen.getByRole("button", { name: "Tutorial" });
    expect(screen.queryByRole("list")).toBeNull();
    await userEvent.click(botao);
    expect(screen.getByRole("list")).toBeTruthy();
    expect(botao.getAttribute("aria-expanded")).toBe("true");
  });

  it("recusa arquivo que não é .xlsx sem chamar o servidor", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderizar();
    // Com applyAccept, o teste simularia o filtro do seletor e nunca chegaria ao código de validação.
    // Aqui o arquivo chega mesmo assim, como acontece quando a pessoa troca para "todos os arquivos".
    const usuario = userEvent.setup({ applyAccept: false });
    await usuario.upload(inputArquivo(container), new File(["%PDF"], "curriculo.pdf", { type: "application/pdf" }));
    expect((await screen.findByRole("alert")).textContent).toContain("não é uma planilha .xlsx");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envia a planilha preenchida e oferece a versão atualizada para baixar", async () => {
    const fetchMock = vi.fn(async () => respostaJson({ novas: 2, existentes: 1, arquivoBase64: btoa("ATUALIZADA") }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderizar();
    await userEvent.upload(inputArquivo(container), new File(["x"], "controle.xlsx"));
    const link = await screen.findByRole("link", { name: "Baixar planilha atualizada" });
    expect(link.getAttribute("download")).toBe("controle atualizada.xlsx");
    expect(screen.getByRole("status").textContent).toContain("2 vaga(s) adicionada(s), 1 já estavam lá");
    const corpo = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(corpo.arquivoBase64).toBe(btoa("x"));
  });

  it("mostra a razão quando o servidor recusa o arquivo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      respostaJson({ erro: "esta planilha não é o modelo de controle: as colunas da linha 2 não batem" }, 400)));
    const { container } = renderizar();
    await userEvent.upload(inputArquivo(container), new File(["x"], "outra.xlsx"));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("não é o modelo de controle"));
  });
});
