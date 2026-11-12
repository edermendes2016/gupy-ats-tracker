// Cliente HTTP do BFF. Única parte da interface que sabe as URLs.
import type { EntradaAnalise, Metricas, NovaVaga, ResultadoAnalise, Status, Vaga } from "../../dominio/tipos";

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroApi";
  }
}

function query(params: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) if (valor) p.set(chave, valor);
  const texto = p.toString();
  return texto ? `?${texto}` : "";
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: { "content-type": "application/json", accept: "application/json" },
  });
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    const mensagem = (corpo as { erro?: string } | null)?.erro ?? `erro HTTP ${resposta.status}`;
    throw new ErroApi(resposta.status, mensagem);
  }
  return corpo as T;
}

export const api = {
  listarVagas: (filtro: { status?: Status; anonimo?: boolean }) =>
    requisitar<Vaga[]>(
      `/api/vagas${query({ status: filtro.status, anonimo: filtro.anonimo ? "true" : undefined })}`,
    ),

  obterVaga: (id: string, anonimo: boolean) =>
    requisitar<Vaga>(`/api/vagas/${encodeURIComponent(id)}${query({ anonimo: anonimo ? "true" : undefined })}`),

  registrarVaga: (nova: NovaVaga) =>
    requisitar<Vaga>("/api/vagas", { method: "POST", body: JSON.stringify(nova) }),

  atualizarStatus: (id: string, status: Status) =>
    requisitar<Vaga>(`/api/vagas/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  ranking: (anonimo: boolean) =>
    requisitar<Vaga[]>(`/api/ranking${query({ anonimo: anonimo ? "true" : undefined })}`),

  metricas: () => requisitar<Metricas>("/api/metricas"),

  excluirVaga: (id: string, anonimo: boolean) =>
    requisitar<void>(
      `/api/vagas/${encodeURIComponent(id)}${query({ anonimo: anonimo ? "true" : undefined })}`,
      { method: "DELETE" },
    ),

  analisarCurriculo: (entrada: EntradaAnalise) =>
    requisitar<ResultadoAnalise>("/api/analises", { method: "POST", body: JSON.stringify(entrada) }),

  exportarPlanilha: (caminho: string) =>
    requisitar<{ novas: number; existentes: number }>("/api/planilha", {
      method: "POST",
      body: JSON.stringify({ caminho }),
    }),
};
