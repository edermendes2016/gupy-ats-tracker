// Clientes gRPC para o serviço Python. Os .proto ficam na raiz do repositório (proto/).
import { fileURLToPath } from "node:url";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

import type { Metricas, NovaVaga, Status, Vaga } from "../../dominio/vaga.js";
import {
  ErroConflito,
  ErroEntradaInvalida,
  ErroIndisponivel,
  ErroNaoEncontrada,
} from "../../aplicacao/erros.js";
import type {
  AnaliseRepositorio,
  PlanilhaRepositorio,
  RankingRepositorio,
  VagaRepositorio,
} from "../../aplicacao/portas.js";
import {
  metricasDoProto,
  novaVagaParaProto,
  paraEnum,
  vagaDoProto,
} from "./adaptador.js";

const PROTO_DIR = fileURLToPath(new URL("../../../../proto/", import.meta.url));
const ARQUIVOS = [
  "gupy_tracker/v1/vagas.proto",
  "gupy_tracker/v1/ranking.proto",
  "gupy_tracker/v1/planilha.proto",
  "gupy_tracker/v1/analise.proto",
];
const PRAZO_MS = 5000;

const pacote = grpc.loadPackageDefinition(
  protoLoader.loadSync(ARQUIVOS, {
    includeDirs: [process.env.GUPY_PROTO_DIR ?? PROTO_DIR],
    keepCase: true,
    enums: String,
    defaults: true,
    oneofs: true,
  }),
) as unknown as { gupy_tracker: { v1: Record<string, any> } };

const { VagasService, RankingService, PlanilhaService, AnaliseService } = pacote.gupy_tracker.v1;

/** Traduz códigos gRPC em erros da aplicação. */
export function traduzirErro(err: grpc.ServiceError): Error {
  const detalhe = err.details || err.message;
  switch (err.code) {
    case grpc.status.NOT_FOUND:
      return new ErroNaoEncontrada(detalhe);
    case grpc.status.ALREADY_EXISTS:
      return new ErroConflito(detalhe);
    case grpc.status.INVALID_ARGUMENT:
    case grpc.status.FAILED_PRECONDITION:
      // Ex.: planilha inexistente ou ilegível. É um problema do pedido, não do servidor.
      return new ErroEntradaInvalida(detalhe);
    case grpc.status.UNAVAILABLE:
    case grpc.status.DEADLINE_EXCEEDED:
      return new ErroIndisponivel("serviço de vagas indisponível (gRPC): " + detalhe);
    default:
      return err;
  }
}

function chamar<T>(
  cliente: grpc.Client,
  metodo: string,
  req: object,
): Promise<T> {
  return new Promise((resolve, reject) => {
    // Chamadas unárias do stub gerado pelo proto-loader: cliente[metodo](req, opções, callback).
    const stub = cliente as unknown as Record<string, (...a: unknown[]) => void>;
    stub[metodo]!(req, { deadline: Date.now() + PRAZO_MS }, (err: grpc.ServiceError | null, res: T) =>
      err ? reject(traduzirErro(err)) : resolve(res),
    );
  });
}

export interface Repositorios {
  vagas: VagaRepositorio;
  ranking: RankingRepositorio;
  planilha: PlanilhaRepositorio;
  analise: AnaliseRepositorio;
  fechar(): void;
}

/** Cria as implementações gRPC das portas, apontando para o endereço do serviço Python. */
export function criarRepositoriosGrpc(endereco: string): Repositorios {
  const credenciais = grpc.credentials.createInsecure();
  const vagasCli = new VagasService(endereco, credenciais);
  const rankingCli = new RankingService(endereco, credenciais);
  const planilhaCli = new PlanilhaService(endereco, credenciais);
  const analiseCli = new AnaliseService(endereco, credenciais);

  const vagas: VagaRepositorio = {
    async listar(filtro) {
      const res = await chamar<{ vagas: Record<string, any>[] }>(vagasCli, "ListarVagas", {
        status: filtro.status ? paraEnum("STATUS", filtro.status, "") : undefined,
        anonimo: filtro.anonimo ?? false,
      });
      return res.vagas.map(vagaDoProto);
    },
    async obter(id, anonimo) {
      return vagaDoProto(await chamar(vagasCli, "ObterVaga", { id, anonimo }));
    },
    async registrar(nova: NovaVaga) {
      return vagaDoProto(await chamar(vagasCli, "RegistrarVaga", novaVagaParaProto(nova)));
    },
    async excluir(id, anonimo) {
      await chamar(vagasCli, "ExcluirVaga", { id, anonimo });
    },
    async atualizarStatus(id: string, status: Status, data?: string) {
      return vagaDoProto(
        await chamar(vagasCli, "AtualizarStatus", {
          id,
          novo_status: paraEnum("STATUS", status, "analisada"),
          data: data ?? "",
        }),
      );
    },
  };

  const ranking: RankingRepositorio = {
    async ranking(anonimo) {
      const res = await chamar<{ vagas_ordenadas: Record<string, any>[] }>(rankingCli, "Ranking", { anonimo });
      return res.vagas_ordenadas.map(vagaDoProto);
    },
    async metricas(): Promise<Metricas> {
      return metricasDoProto(await chamar(rankingCli, "Metricas", {}));
    },
  };

  const planilha: PlanilhaRepositorio = {
    async exportar(caminho) {
      const res = await chamar<{ novas: number; existentes: number }>(planilhaCli, "Exportar", { caminho });
      return { novas: Number(res.novas), existentes: Number(res.existentes) };
    },
    async gerarModelo(caminho) {
      await chamar(planilhaCli, "GerarModelo", { caminho });
    },
  };

  const analise: AnaliseRepositorio = {
    async analisar(e) {
      const res = await chamar<Record<string, any>>(analiseCli, "Analisar", {
        curriculo: e.curriculo,
        nome_arquivo: e.nomeArquivo,
        descricao: e.descricao ?? "",
        responsabilidades: e.responsabilidades ?? "",
        requisitos: e.requisitos ?? "",
        modelo: e.modelo ?? "",
      });
      const anosPedidos = Number(res.anos_pedidos);
      return {
        criterios: {
          obrigatorios: Number(res.criterios.obrigatorios),
          desejaveis: Number(res.criterios.desejaveis),
          experiencia: Number(res.criterios.experiencia),
          dominio: Number(res.criterios.dominio),
          logistica: Number(res.criterios.logistica),
        },
        matchScore: Number(res.match_score),
        classificacao: res.classificacao,
        palavrasChave: res.palavras_chave ?? [],
        lacunas: res.lacunas ?? [],
        avisos: res.avisos ?? [],
        sugestoes: res.sugestoes ?? [],
        anosCurriculo: Number(res.anos_curriculo),
        anosPedidos: anosPedidos > 0 ? anosPedidos : null,
      };
    },
  };

  return {
    vagas,
    ranking,
    planilha,
    analise,
    fechar() {
      for (const c of [vagasCli, rankingCli, planilhaCli, analiseCli]) c.close();
    },
  };
}

export type { Vaga };
