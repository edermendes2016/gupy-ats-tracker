// Casos de uso: orquestram as portas. Não sabem de HTTP nem de gRPC.
import type { Metricas, NovaVaga, Status, Vaga } from "../dominio/vaga.js";
import { montarAventura, xpBonus, type Aventura } from "../dominio/aventura.js";
import { calcularConquistas, type Conquista } from "../dominio/conquistas.js";
import { missoesConcluidas, missoesDoDia, type Missao, type MissaoManual, type RegistroDia } from "../dominio/missoes.js";
import type {
  AnaliseRepositorio,
  EntradaAnalise,
  PlanilhaRepositorio,
  ResultadoPlanilha,
  MissoesRepositorio,
  RankingRepositorio,
  ResultadoAnalise,
  VagaRepositorio,
} from "./portas.js";

export interface Dependencias {
  vagas: VagaRepositorio;
  ranking: RankingRepositorio;
  planilha: PlanilhaRepositorio;
  analise: AnaliseRepositorio;
  /** Opcional: sem ele, as marcações das missões ficam só em memória. */
  missoes?: MissoesRepositorio;
  hoje?: () => string;
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

export function criarCasosDeUso(dep: Dependencias) {
  const hoje = dep.hoje ?? (() => new Date().toISOString().slice(0, 10));
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

    modeloPlanilha(): Promise<Buffer> {
      return dep.planilha.modelo();
    },

    atualizarPlanilha(conteudo: Buffer): Promise<ResultadoPlanilha> {
      return dep.planilha.atualizar(conteudo);
    },

    /** Personagem da aba Aventura. Em modo anônimo, a lista por vaga não sai. */
    async aventura(anonimo = false): Promise<Aventura> {
      const vagas = await dep.vagas.listar({});
      const registros = await repoMissoes.ler();
      const desbloqueadas = calcularConquistas(vagas, hoje(), true).filter((c) => c.desbloqueada).length;
      const bonus = xpBonus(desbloqueadas, missoesConcluidas(vagas, registros));
      return montarAventura(vagas, hoje(), anonimo, bonus);
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
  };
}

export type CasosDeUso = ReturnType<typeof criarCasosDeUso>;
