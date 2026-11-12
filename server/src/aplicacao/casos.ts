// Casos de uso: orquestram as portas. Não sabem de HTTP nem de gRPC.
import type { Metricas, NovaVaga, Status, Vaga } from "../dominio/vaga.js";
import { montarAventura, xpBonus, type Aventura, type ProgressoEtapas } from "../dominio/aventura.js";
import { calcularConquistas, type Conquista } from "../dominio/conquistas.js";
import { missoesConcluidas, missoesDoDia, type Missao, type MissaoManual, type RegistroDia } from "../dominio/missoes.js";
import { ErroConflito, ErroNaoEncontrada } from "./erros.js";
import type {
  AnaliseRepositorio,
  EntradaAnalise,
  PlanilhaRepositorio,
  MissoesRepositorio,
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
  /** Opcional: sem ele, as marcações das missões ficam só em memória. */
  missoes?: MissoesRepositorio;
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

function memoriaMissoes(): MissoesRepositorio {
  const mapa: Record<string, RegistroDia> = {};
  return {
    async ler() {
      return structuredClone(mapa);
    },
    async marcar(dia, missao: MissaoManual, feita) {
      mapa[dia] = { ...mapa[dia], [missao]: feita };
    },
  };
}

const normaliza = (texto: string) => texto.trim().toLocaleLowerCase("pt-BR");

export function criarCasosDeUso(dep: Dependencias) {
  const hoje = dep.hoje ?? (() => new Date().toISOString().slice(0, 10));
  const progresso = dep.progresso ?? memoriaProgresso();
  const repoMissoes = dep.missoes ?? memoriaMissoes();

  /** Missões do dia: candidaturas vêm das vagas; estudo e reforço, das marcações e das Métricas. */
  async function missoesDeHoje(): Promise<{ dia: string; missoes: Missao[] }> {
    const dia = hoje();
    const [vagas, termos, registros] = await Promise.all([
      dep.vagas.listar({}),
      dep.ranking.metricas(),
      repoMissoes.ler(),
    ]);
    return { dia, missoes: missoesDoDia(dia, vagas, registros[dia], termos) };
  }

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
      const registros = await repoMissoes.ler();
      const desbloqueadas = calcularConquistas(vagas, hoje(), true).filter((c) => c.desbloqueada).length;
      const bonus = xpBonus(desbloqueadas, missoesConcluidas(vagas, registros));
      return montarAventura(vagas, await progresso.ler(), hoje(), anonimo, bonus);
    },

    /** Conquistas calculadas a partir das vagas. Em modo anônimo, os textos não citam empresa. */
    async conquistas(anonimo = false): Promise<Conquista[]> {
      return calcularConquistas(await dep.vagas.listar({}), hoje(), anonimo);
    },

    /** Missões de hoje. Só usa métricas agregadas e termos de habilidade, nada identificável. */
    missoes(): Promise<{ dia: string; missoes: Missao[] }> {
      return missoesDeHoje();
    },

    /** Marca ou desmarca estudo e reforço de hoje. */
    async marcarMissao(missao: MissaoManual, feita: boolean): Promise<{ dia: string; missoes: Missao[] }> {
      await repoMissoes.marcar(hoje(), missao, feita);
      return missoesDeHoje();
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
