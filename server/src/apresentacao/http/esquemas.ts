// Validação da entrada HTTP. Erros aqui viram 400 antes de chegar à aplicação.
import { z } from "zod";
import { MODELOS, SENIORIDADES, STATUS } from "../../dominio/vaga.js";

const nota = z.number().int().min(0).max(100);
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD");
const booleanoQuery = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => v === "true");

export const FiltroQuery = z.object({
  status: z.enum(STATUS).optional(),
  anonimo: booleanoQuery,
});

export const AnonimoQuery = z.object({ anonimo: booleanoQuery });

export const NovaVagaBody = z.object({
  data: dataIso.optional(),
  empresa: z.string().trim().min(1),
  cargo: z.string().trim().min(1),
  senioridade: z.enum(SENIORIDADES).default("nao_informada"),
  area: z.string().default("outra"),
  modelo: z.enum(MODELOS).nullable().default(null),
  url: z.string().url().optional(),
  status: z.enum(STATUS).default("analisada"),
  criterios: z.object({
    obrigatorios: nota,
    desejaveis: nota,
    experiencia: nota,
    dominio: nota,
    logistica: nota,
  }),
  palavrasChave: z.array(z.string()).default([]),
  lacunas: z.array(z.string()).default([]),
  descricao: z.string().optional(),
  responsabilidades: z.string().optional(),
  requisitos: z.string().optional(),
});

export const AtualizarStatusBody = z.object({
  status: z.enum(STATUS),
  data: dataIso.optional(),
});

export const ExportarPlanilhaBody = z.object({
  caminho: z.string().min(1),
});

export const AnalisarBody = z.object({
  nomeArquivo: z.string().min(1),
  arquivoBase64: z.string().min(1),
  descricao: z.string().optional(),
  responsabilidades: z.string().optional(),
  requisitos: z.string().optional(),
  modelo: z.enum(MODELOS).optional(),
});

export const IdParams = z.object({ id: z.string().min(1) });

export const MissaoParams = z.object({ id: z.enum(["estudo", "reforco"]) });
export const MarcarMissaoBody = z.object({ feita: z.boolean() });
