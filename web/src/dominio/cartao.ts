// Cartão para compartilhar (modo anônimo). Só agregados: nenhuma empresa, cargo, data
// completa, id ou link entra aqui. Os termos são palavras-chave técnicas do próprio perfil.
import type { Metricas } from "./tipos";

export interface Cartao {
  titulo: string;
  indicadores: Array<{ rotulo: string; valor: string }>;
  pontosFortes: string[];
  lacunas: string[];
  rodape: string;
}

export const LIMITE_TERMOS_CARTAO = 5;

export function montarCartao(m: Metricas, limite = LIMITE_TERMOS_CARTAO): Cartao {
  return {
    titulo: "Minha busca de emprego em números",
    indicadores: [
      { rotulo: "vagas analisadas", valor: String(m.total) },
      { rotulo: "candidaturas", valor: String(m.enviadas) },
      { rotulo: "chegaram à entrevista", valor: String(m.chegaramEntrevista) },
      { rotulo: "conversão em entrevista", valor: `${Math.round(m.taxaConversao * 100)}%` },
      { rotulo: "score médio de aderência", valor: `${m.scoreMedio}%` },
    ],
    pontosFortes: m.pontosFortes.slice(0, limite).map((t) => t.nome),
    lacunas: m.lacunas.slice(0, limite).map((t) => t.nome),
    rodape: "Dados agregados e anônimos",
  };
}

/** Versão em texto, para colar nas redes. */
export function textoCartao(c: Cartao): string {
  const linhas = [c.titulo, ""];
  for (const i of c.indicadores) linhas.push(`• ${i.valor} ${i.rotulo}`);
  if (c.pontosFortes.length) linhas.push("", `Pontos fortes: ${c.pontosFortes.join(", ")}`);
  if (c.lacunas.length) linhas.push(`Para estudar: ${c.lacunas.join(", ")}`);
  linhas.push("", c.rodape);
  return linhas.join("\n");
}
