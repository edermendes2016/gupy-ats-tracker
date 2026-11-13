import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ErroApi } from "../src/infraestrutura/api/cliente";

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("cliente HTTP", () => {
  it("monta a query string só com filtros preenchidos", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => respostaJson([]));
    vi.stubGlobal("fetch", fetchMock);
    await api.listarVagas({ status: "entrevista", anonimo: true });
    await api.listarVagas({ anonimo: false });
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toEqual(["/api/vagas?status=entrevista&anonimo=true", "/api/vagas"]);
  });

  it("transforma erro do BFF em ErroApi com a mensagem do corpo", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => respostaJson({ erro: "vaga 'x' não encontrada" }, 404)));
    const erro = await api.obterVaga("x", false).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as ErroApi).status).toBe(404);
    expect((erro as ErroApi).message).toBe("vaga 'x' não encontrada");
  });

  it("envia o status em PATCH com JSON", async () => {
    const fetchMock = vi.fn(async () => respostaJson({ id: "a" }));
    vi.stubGlobal("fetch", fetchMock);
    await api.atualizarStatus("a b", "oferta");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/vagas/a%20b/status");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ status: "oferta" });
  });



  it("atualiza a planilha enviando o arquivo em base64 no corpo JSON", async () => {
    const fetchMock = vi.fn(async () => respostaJson({ novas: 1, existentes: 0, arquivoBase64: "QQ==" }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await api.atualizarPlanilha("QQ==");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/planilha/atualizar");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ arquivoBase64: "QQ==" });
    expect(r).toEqual({ novas: 1, existentes: 0, arquivoBase64: "QQ==" });
  });
});
