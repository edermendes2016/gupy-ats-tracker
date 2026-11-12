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
import { z as zod } from "zod";
import {
  AnonimoQuery,
  AnalisarBody,
  AtualizarStatusBody,
  ExportarPlanilhaBody,
  FiltroQuery,
  IdParams,
  NovaVagaBody,
} from "./esquemas.js";

const ProgressoEtapasBody = zod
  .object({
    empresa: zod.string().trim().min(1),
    cargo: zod.string().trim().min(1),
    atual: zod.number().int().min(0),
    total: zod.number().int().min(1),
  })
  .refine((c) => c.atual <= c.total, { message: "atual não pode passar de total", path: ["atual"] });

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

export function criarApp(
  casos: CasosDeUso,
  opcoes: { logger?: boolean; escolherArquivo?: () => Promise<string | null> } = {},
): FastifyInstance {
  const app = Fastify({ logger: opcoes.logger ?? false });

  // DELETE (e outras chamadas sem corpo) pode vir com Content-Type JSON e corpo vazio.
  // O parser padrão do Fastify recusa isso; aqui corpo vazio vira "sem corpo".
  app.removeContentTypeParser("application/json");
  app.addContentTypeParser("application/json", { parseAs: "string" }, (_req, corpo, pronto) => {
    if (corpo === "") return pronto(null, undefined);
    try {
      pronto(null, JSON.parse(corpo as string));
    } catch (erro) {
      pronto(erro as Error, undefined);
    }
  });

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

  app.delete<{ Params: { id: string } }>("/api/vagas/:id", async (req, resposta) => {
    const { id } = validar(IdParams, req.params);
    const { anonimo } = validar(AnonimoQuery, req.query);
    await casos.excluirVaga(id, anonimo);
    return resposta.status(204).send();
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

  app.get("/api/aventura", async (req) => {
    const { anonimo } = validar(AnonimoQuery, req.query);
    return casos.aventura(anonimo);
  });

  app.post("/api/aventura/progresso", async (req) => {
    const corpo = validar(ProgressoEtapasBody, req.body);
    return casos.registrarProgresso(corpo);
  });

  app.post("/api/analises", async (req) => {
    const corpo = validar(AnalisarBody, req.body);
    return casos.analisarCurriculo({
      nomeArquivo: corpo.nomeArquivo,
      curriculo: Buffer.from(corpo.arquivoBase64, "base64"),
      descricao: corpo.descricao,
      responsabilidades: corpo.responsabilidades,
      requisitos: corpo.requisitos,
      modelo: corpo.modelo,
    });
  });

  app.post("/api/planilha/escolher", async (_req, resposta) => {
    if (!opcoes.escolherArquivo) {
      return resposta.status(501).send({ erro: "seleção de arquivo indisponível neste sistema: digite o caminho" });
    }
    const caminho = await opcoes.escolherArquivo();
    if (!caminho) return resposta.status(204).send();
    return { caminho };
  });

  app.post("/api/planilha/gerar", async (req, resposta) => {
    const { caminho } = validar(ExportarPlanilhaBody, req.body);
    await casos.gerarPlanilha(caminho);
    return resposta.status(201).send({ caminho });
  });

  app.post("/api/planilha", async (req) => {
    const { caminho } = validar(ExportarPlanilhaBody, req.body);
    return casos.exportarPlanilha(caminho);
  });

  return app;
}
