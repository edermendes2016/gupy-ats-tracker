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
import type { PlanilhaRepositorio, RankingRepositorio, VagaRepositorio } from "../../aplicacao/portas.js";
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

const { VagasService, RankingService, PlanilhaService } = pacote.gupy_tracker.v1;

/** Traduz códigos gRPC em erros da aplicação. */
export function traduzirErro(err: grpc.ServiceError): Error {
  const detalhe = err.details || err.message;
  switch (err.code) {
    case grpc.status.NOT_FOUND:
      return new ErroNaoEncontrada(detalhe);
    case grpc.status.ALREADY_EXISTS:
      return new ErroConflito(detalhe);
    case grpc.status.INVALID_ARGUMENT:
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
  fechar(): void;
}

/** Cria as implementações gRPC das portas, apontando para o endereço do serviço Python. */
export function criarRepositoriosGrpc(endereco: string): Repositorios {
  const credenciais = grpc.credentials.createInsecure();
  const vagasCli = new VagasService(endereco, credenciais);
  const rankingCli = new RankingService(endereco, credenciais);
  const planilhaCli = new PlanilhaService(endereco, credenciais);

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
  };

  return {
    vagas,
    ranking,
    planilha,
    fechar() {
      for (const c of [vagasCli, rankingCli, planilhaCli]) c.close();
    },
  };
}

export type { Vaga };
