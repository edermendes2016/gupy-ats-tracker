// Casos de uso: orquestram as portas. Não sabem de HTTP nem de gRPC.
import type { Metricas, NovaVaga, Status, Vaga } from "../dominio/vaga.js";
import { montarAventura, type Aventura, type ProgressoEtapas } from "../dominio/aventura.js";
import { ErroConflito, ErroNaoEncontrada } from "./erros.js";
import type {
  AnaliseRepositorio,
  EntradaAnalise,
  PlanilhaRepositorio,
  ProgressoRepositorio,
  RankingRepositorio,
  ResultadoAnalise,
  VagaRepositorio,
} from "./portas.js";

export interface Dependencias {
  vagas: VagaRepositorio;
  ranking: RankingRepositorio;
  planilha: PlanilhaRepositorio;
  analise: AnaliseRepositorio;
  /** Opcional: sem ele, o progresso das etapas fica só em memória. */
  progresso?: ProgressoRepositorio;
  hoje?: () => string;
}

function memoriaProgresso(): ProgressoRepositorio {
  const mapa: Record<string, ProgressoEtapas> = {};
  return {
    async ler() {
      return { ...mapa };
    },
    async salvar(id, progresso) {
      mapa[id] = progresso;
    },
  };
}

const normaliza = (texto: string) => texto.trim().toLocaleLowerCase("pt-BR");

export function criarCasosDeUso(dep: Dependencias) {
  const hoje = dep.hoje ?? (() => new Date().toISOString().slice(0, 10));
  const progresso = dep.progresso ?? memoriaProgresso();

  return {
    listarVagas(filtro: { status?: Status; anonimo?: boolean }): Promise<Vaga[]> {
      return dep.vagas.listar(filtro);
    },

    obterVaga(id: string, anonimo = false): Promise<Vaga> {
      return dep.vagas.obter(id, anonimo);
    },

    registrarVaga(nova: NovaVaga): Promise<Vaga> {
      return dep.vagas.registrar({ ...nova, data: nova.data ?? hoje() });
    },

    atualizarStatus(id: string, status: Status, data?: string): Promise<Vaga> {
      return dep.vagas.atualizarStatus(id, status, data ?? hoje());
    },

    excluirVaga(id: string, anonimo = false): Promise<void> {
      return dep.vagas.excluir(id, anonimo);
    },

    ranking(anonimo = false): Promise<Vaga[]> {
      return dep.ranking.ranking(anonimo);
    },

    metricas(): Promise<Metricas> {
      return dep.ranking.metricas();
    },

    analisarCurriculo(entrada: EntradaAnalise): Promise<ResultadoAnalise> {
      return dep.analise.analisar(entrada);
    },

    exportarPlanilha(caminho: string): Promise<{ novas: number; existentes: number }> {
      return dep.planilha.exportar(caminho);
    },

    gerarPlanilha(caminho: string): Promise<void> {
      return dep.planilha.gerarModelo(caminho);
    },

    /** Personagem da aba Aventura. Em modo anônimo, a lista por vaga não sai. */
    async aventura(anonimo = false): Promise<Aventura> {
      const vagas = await dep.vagas.listar({});
      return montarAventura(vagas, await progresso.ler(), hoje(), anonimo);
    },

    /**
     * Grava o progresso de uma etapa pela empresa e cargo, para quem não usa id.
     * Quem chama (extensão ou formulário) informa empresa e cargo; a vaga precisa existir.
     */
    async registrarProgresso(entrada: {
      empresa: string;
      cargo: string;
      atual: number;
      total: number;
    }): Promise<{ id: string; empresa: string; cargo: string; atual: number; total: number }> {
      const vagas = await dep.vagas.listar({});
      const achadas = vagas.filter(
        (v) => normaliza(v.empresa) === normaliza(entrada.empresa) && normaliza(v.cargo) === normaliza(entrada.cargo),
      );
      if (achadas.length === 0) {
        throw new ErroNaoEncontrada(`vaga não cadastrada: ${entrada.empresa} / ${entrada.cargo}`);
      }
      if (achadas.length > 1) {
        throw new ErroConflito(`há ${achadas.length} vagas com esse nome; registre o progresso pela aba Vagas`);
      }
      const vaga = achadas[0]!;
      const valor = { atual: entrada.atual, total: entrada.total };
      await progresso.salvar(vaga.id, valor);
      return { id: vaga.id, empresa: vaga.empresa, cargo: vaga.cargo, ...valor };
    },
  };
}

export type CasosDeUso = ReturnType<typeof criarCasosDeUso>;
