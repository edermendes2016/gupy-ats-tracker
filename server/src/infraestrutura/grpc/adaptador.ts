// Conversões entre as mensagens gRPC (snake_case, enums como texto) e o domínio TypeScript.
import type { Metricas, Modelo, NovaVaga, Senioridade, Status, Vaga } from "../../dominio/vaga.js";

/** Remove o prefixo do enum ("STATUS_ENTREVISTA" -> "entrevista"). */
export function semPrefixo(valor: string, prefixo: string): string {
  const p = `${prefixo}_`;
  return (valor.startsWith(p) ? valor.slice(p.length) : valor).toLowerCase();
}

export function paraEnum(prefixo: string, valor: string | null | undefined, padrao: string): string {
  return `${prefixo}_${(valor ?? padrao).toUpperCase()}`;
}

const textoOpcional = (valor: unknown): string | undefined =>
  typeof valor === "string" && valor !== "" ? valor : undefined;

/** Mensagem Vaga (JSON do proto-loader) -> Vaga do domínio. */
export function vagaDoProto(p: Record<string, any>): Vaga {
  const modelo = semPrefixo(p.modelo ?? "", "MODELO");
  const vaga: Vaga = {
    id: p.id,
    data: p.data,
    empresa: p.empresa,
    cargo: p.cargo,
    senioridade: semPrefixo(p.senioridade ?? "", "SENIORIDADE") as Senioridade,
    area: p.area,
    modelo: modelo === "nao_informado" || modelo === "" ? null : (modelo as Modelo),
    status: semPrefixo(p.status, "STATUS") as Status,
    criterios: {
      obrigatorios: Number(p.criterios?.obrigatorios ?? 0),
      desejaveis: Number(p.criterios?.desejaveis ?? 0),
      experiencia: Number(p.criterios?.experiencia ?? 0),
      dominio: Number(p.criterios?.dominio ?? 0),
      logistica: Number(p.criterios?.logistica ?? 0),
    },
    matchScore: Number(p.match_score ?? 0),
    classificacao: p.classificacao ?? "",
    palavrasChave: p.palavras_chave ?? [],
    lacunas: p.lacunas ?? [],
    historico: (p.historico ?? []).map((h: Record<string, string | undefined>) => ({
      data: h.data ?? "",
      status: semPrefixo(h.status ?? "", "STATUS") as Status,
    })),
  };
  const url = textoOpcional(p.url);
  if (url) vaga.url = url;
  for (const campo of ["descricao", "responsabilidades", "requisitos"] as const) {
    const valor = textoOpcional(p[campo]);
    if (valor) vaga[campo] = valor;
  }
  return vaga;
}

/** NovaVaga -> RegistrarVagaRequest (JSON). Campos indefinidos são omitidos. */
export function novaVagaParaProto(nova: NovaVaga): { vaga: Record<string, unknown> } {
  const vaga = {
    data: nova.data,
    empresa: nova.empresa,
    cargo: nova.cargo,
    senioridade: paraEnum("SENIORIDADE", nova.senioridade, "nao_informada"),
    area: nova.area,
    modelo: paraEnum("MODELO", nova.modelo, "nao_informado"),
    url: nova.url,
    status: paraEnum("STATUS", nova.status, "analisada"),
    criterios: { ...nova.criterios },
    palavras_chave: nova.palavrasChave,
    lacunas: nova.lacunas,
    descricao: nova.descricao,
    responsabilidades: nova.responsabilidades,
    requisitos: nova.requisitos,
  };
  return { vaga: Object.fromEntries(Object.entries(vaga).filter(([, v]) => v !== undefined)) };
}

export function metricasDoProto(p: Record<string, any>): Metricas {
  const termos = (lista: any[] | undefined) =>
    (lista ?? []).map((t) => ({ nome: String(t.nome), vagas: Number(t.vagas ?? 0) }));
  return {
    total: Number(p.total ?? 0),
    enviadas: Number(p.enviadas ?? 0),
    chegaramEntrevista: Number(p.chegaram_entrevista ?? 0),
    taxaConversao: Number(p.taxa_conversao ?? 0),
    ofertas: Number(p.ofertas ?? 0),
    scoreMedio: Number(p.score_medio ?? 0),
    porStatus: (p.por_status ?? []).map((c: any) => ({ status: String(c.status), vagas: Number(c.vagas ?? 0) })),
    faixas: (p.faixas ?? []).map((f: any) => ({
      faixa: String(f.faixa),
      enviadas: Number(f.enviadas ?? 0),
      entrevistas: Number(f.entrevistas ?? 0),
    })),
    evolucao: (p.evolucao ?? []).map((e: any) => ({
      mes: String(e.mes),
      analisadas: Number(e.analisadas ?? 0),
      enviadas: Number(e.enviadas ?? 0),
      entrevistas: Number(e.entrevistas ?? 0),
    })),
    pontosFortes: termos(p.pontos_fortes),
    lacunas: termos(p.lacunas),
  };
}
