import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "../src/apresentacao/App";
import { PASSOS_TUTORIAL, Tutorial, tutorialJaVisto } from "../src/apresentacao/componentes/Tutorial";

function renderizarApp() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={cliente}>
      <App />
    </QueryClientProvider>,
  );
}

describe("Tutorial (componente)", () => {
  it("avança, volta e conclui", async () => {
    const mudar = vi.fn();
    const fechar = vi.fn();
    const { rerender } = render(<Tutorial passo={0} aoMudarPasso={mudar} aoFechar={fechar} />);
    expect(screen.getByText(`Passo 1 de ${PASSOS_TUTORIAL.length}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Voltar" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(mudar).toHaveBeenCalledWith(1);

    rerender(<Tutorial passo={2} aoMudarPasso={mudar} aoFechar={fechar} />);
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(mudar).toHaveBeenLastCalledWith(1);

    rerender(<Tutorial passo={PASSOS_TUTORIAL.length - 1} aoMudarPasso={mudar} aoFechar={fechar} />);
    expect(screen.queryByRole("button", { name: "Próximo" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it("Pular e Esc fecham", async () => {
    const fechar = vi.fn();
    render(<Tutorial passo={1} aoMudarPasso={() => {}} aoFechar={fechar} />);
    await userEvent.click(screen.getByRole("button", { name: "Pular" }));
    await userEvent.keyboard("{Escape}");
    expect(fechar).toHaveBeenCalledTimes(2);
  });

  it("expõe o progresso para leitores de tela", () => {
    render(<Tutorial passo={2} aoMudarPasso={() => {}} aoFechar={() => {}} />);
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("3");
  });
});

describe("Tutorial no App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } })));
  });

  it("abre na primeira visita e leva à aba do passo", async () => {
    renderizarApp();
    expect(screen.getByRole("dialog", { name: "Tutorial de primeiro cadastro" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    expect(screen.getByRole("tab", { name: "Nova vaga" }).getAttribute("aria-selected")).toBe("true");
  });

  it("Pular fecha, lembra a escolha e não reabre na próxima visita", async () => {
    const { unmount } = renderizarApp();
    await userEvent.click(screen.getByRole("button", { name: "Pular" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(tutorialJaVisto()).toBe(true);
    unmount();
    renderizarApp();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Concluir termina no Ranking e “Tutorial” reabre desde o início", async () => {
    renderizarApp();
    for (let i = 0; i < PASSOS_TUTORIAL.length - 1; i++) {
      await userEvent.click(screen.getByRole("button", { name: "Próximo" }));
    }
    await userEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("tab", { name: "Ranking" }).getAttribute("aria-selected")).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: "Tutorial" }));
    expect(screen.getByText(`Passo 1 de ${PASSOS_TUTORIAL.length}`)).toBeTruthy();
  });

  it("funciona mesmo com localStorage indisponível", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("bloqueado"); });
    renderizarApp();
    expect(screen.getByRole("dialog")).toBeTruthy();
    vi.restoreAllMocks();
  });
});
