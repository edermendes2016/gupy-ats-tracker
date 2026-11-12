// Rotas HTTP/JSON (D1: REST simples) que a interface React consome.
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import type { z, ZodError } from "zod";

import type { CasosDeUso } from "../../aplicacao/casos.js";
import {
  ErroConflito,
  ErroEntradaInvalida,
  ErroIndisponivel,
  ErroNaoEncontrada,
} from "../../aplicacao/erros.js";
import type { Metricas, Vaga } from "../../dominio/vaga.js";
import {
  AnonimoQuery,
  AtualizarStatusBody,
  ExportarPlanilhaBody,
  FiltroQuery,
  IdParams,
  NovaVagaBody,
} from "./esquemas.js";

/** Formato JSON de uma vaga, em camelCase, como a interface espera. */
export const vagaJson = (v: Vaga) => v;

function validar<S extends z.ZodTypeAny>(esquema: S, valor: unknown): z.output<S> {
  const r = esquema.safeParse(valor);
  if (!r.success) throw new ErroEntradaInvalida(formatarZod(r.error));
  return r.data;
}

function formatarZod(e: ZodError): string {
  return e.issues.map((i) => `${i.path.join(".") || "corpo"}: ${i.message}`).join("; ");
}

const STATUS_HTTP: Array<[new (...a: any[]) => Error, number]> = [
  [ErroNaoEncontrada, 404],
  [ErroConflito, 409],
  [ErroEntradaInvalida, 400],
  [ErroIndisponivel, 503],
];

export function criarApp(casos: CasosDeUso, opcoes: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: opcoes.logger ?? false });

  app.setErrorHandler((erro: FastifyError | Error, _req, resposta) => {
    for (const [classe, codigo] of STATUS_HTTP) {
      if (erro instanceof classe) {
        return resposta.status(codigo).send({ erro: erro.message });
      }
    }
    // Erros do próprio Fastify (ex.: JSON malformado) já trazem statusCode.
    const codigo = (erro as FastifyError).statusCode ?? 500;
    if (codigo >= 500) app.log.error(erro);
    return resposta.status(codigo).send({ erro: codigo >= 500 ? "erro interno" : erro.message });
  });

  app.get("/api/saude", async () => ({ ok: true }));

  app.get("/api/vagas", async (req) => {
    const q = validar(FiltroQuery, req.query);
    const vagas: Vaga[] = await casos.listarVagas(q);
    return vagas.map(vagaJson);
  });

  app.get<{ Params: { id: string } }>("/api/vagas/:id", async (req) => {
    const { id } = validar(IdParams, req.params);
    const { anonimo } = validar(AnonimoQuery, req.query);
    return vagaJson(await casos.obterVaga(id, anonimo));
  });

  app.post("/api/vagas", async (req, resposta) => {
    const corpo = validar(NovaVagaBody, req.body);
    const criada = await casos.registrarVaga({
      ...corpo,
      modelo: corpo.modelo ?? null,
      url: corpo.url,
      descricao: corpo.descricao,
      responsabilidades: corpo.responsabilidades,
      requisitos: corpo.requisitos,
    });
    return resposta.status(201).send(vagaJson(criada));
  });

  app.patch<{ Params: { id: string } }>("/api/vagas/:id/status", async (req) => {
    const { id } = validar(IdParams, req.params);
    const { status, data } = validar(AtualizarStatusBody, req.body);
    return vagaJson(await casos.atualizarStatus(id, status, data));
  });

  app.get("/api/ranking", async (req) => {
    const { anonimo } = validar(AnonimoQuery, req.query);
    const vagas: Vaga[] = await casos.ranking(anonimo);
    return vagas.map(vagaJson);
  });

  app.get("/api/metricas", async (): Promise<Metricas> => casos.metricas());

  app.post("/api/planilha", async (req) => {
    const { caminho } = validar(ExportarPlanilhaBody, req.body);
    return casos.exportarPlanilha(caminho);
  });

  return app;
}
