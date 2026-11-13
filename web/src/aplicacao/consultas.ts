// Casos de uso da interface: consultas e comandos via TanStack Query.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../infraestrutura/api/cliente";
import type { Status } from "../dominio/tipos";

export function useVagas(filtro: { status?: Status; anonimo: boolean }, habilitado = true) {
  return useQuery({ queryKey: ["vagas", filtro], queryFn: () => api.listarVagas(filtro), enabled: habilitado });
}

export function useRanking(anonimo: boolean, habilitado = true) {
  return useQuery({ queryKey: ["ranking", anonimo], queryFn: () => api.ranking(anonimo), enabled: habilitado });
}

export function useVaga(id: string | null, anonimo: boolean) {
  return useQuery({
    queryKey: ["vaga", id, anonimo],
    queryFn: () => api.obterVaga(id!, anonimo),
    enabled: id !== null,
  });
}

export function useAventura(anonimo: boolean, habilitado = true) {
  return useQuery({ queryKey: ["aventura", anonimo], queryFn: () => api.aventura(anonimo), enabled: habilitado });
}

export function useConquistas(anonimo: boolean, habilitado = true) {
  return useQuery({ queryKey: ["conquistas", anonimo], queryFn: () => api.conquistas(anonimo), enabled: habilitado });
}

export function useMissoes() {
  return useQuery({ queryKey: ["missoes"], queryFn: api.missoes });
}

export function useMarcarMissao() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ id, feita }: { id: "estudo" | "reforco"; feita: boolean }) => api.marcarMissao(id, feita),
    onSuccess: (dados) => {
      cliente.setQueryData(["missoes"], dados);
      return cliente.invalidateQueries({ queryKey: ["aventura"] });
    },
  });
}

export function useMetricas() {
  return useQuery({ queryKey: ["metricas"], queryFn: api.metricas });
}

/** Depois de qualquer escrita, recarrega tudo que pode ter mudado. */
function useInvalidarTudo() {
  const cliente = useQueryClient();
  return () => cliente.invalidateQueries();
}

export function useRegistrarVaga() {
  const invalidar = useInvalidarTudo();
  return useMutation({ mutationFn: api.registrarVaga, onSuccess: invalidar });
}

export function useExcluirVaga() {
  const invalidar = useInvalidarTudo();
  return useMutation({
    mutationFn: ({ id, anonimo }: { id: string; anonimo: boolean }) => api.excluirVaga(id, anonimo),
    onSuccess: invalidar,
  });
}

export function useAnalisarCurriculo() {
  return useMutation({ mutationFn: api.analisarCurriculo });
}

export function useAtualizarStatus() {
  const invalidar = useInvalidarTudo();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: Status }) => api.atualizarStatus(id, status),
    onSuccess: invalidar,
  });
}

export function useAtualizarPlanilha() {
  return useMutation({ mutationFn: (arquivoBase64: string) => api.atualizarPlanilha(arquivoBase64) });
}
