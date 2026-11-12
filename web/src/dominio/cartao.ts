// Cartão para compartilhar (modo anônimo). Só agregados: nenhuma empresa, cargo, data
// completa, id ou link de vaga entra aqui. Os termos são palavras-chave técnicas do próprio perfil.
import { ROTULO_STATUS, STATUS, type Metricas, type Termo } from "./tipos";

export interface Barra {
  nome: string;
  valor: number;
}

export interface Cartao {
  titulo: string;
  indicadores: Array<{ rotulo: string; valor: string }>;
  funil: Barra[];
  pontosFortes: Barra[];
  lacunas: Barra[];
  chamada: string;
  repositorio: string;
  rodape: string;
}

export const LIMITE_TERMOS_CARTAO = 5;
export const LIMITE_FUNIL_CARTAO = 5;

export const REPOSITORIO_URL = "https://github.com/edermendes2016/gupy-ats-tracker";
export const REPOSITORIO_EXIBICAO = "github.com/edermendes2016/gupy-ats-tracker";
export const CHAMADA_CARTAO = "Comece agora";

const paraBarras = (termos: Termo[], limite: number): Barra[] =>
  termos.slice(0, limite).map((t) => ({ nome: t.nome, valor: t.vagas }));

export function montarCartao(m: Metricas, limite = LIMITE_TERMOS_CARTAO): Cartao {
  const contagem = new Map(m.porStatus.map((s) => [s.status, s.vagas]));
  // Cabem até cinco etapas no cartão: ficam as mais povoadas, mantendo a ordem do fluxo.
  const funilCompleto = STATUS.map((s) => ({ nome: ROTULO_STATUS[s], valor: contagem.get(s) ?? 0 })).filter((b) => b.valor > 0);
  const maisPovoadas = new Set([...funilCompleto].sort((a, b) => b.valor - a.valor).slice(0, LIMITE_FUNIL_CARTAO));
  const funil = funilCompleto.filter((b) => maisPovoadas.has(b));
  return {
    titulo: "Minha busca de emprego em números",
    indicadores: [
      { rotulo: "vagas analisadas", valor: String(m.total) },
      { rotulo: "candidaturas", valor: String(m.enviadas) },
      { rotulo: "chegaram à entrevista", valor: String(m.chegaramEntrevista) },
      { rotulo: "conversão em entrevista", valor: `${Math.round(m.taxaConversao * 100)}%` },
      { rotulo: "score médio de aderência", valor: `${m.scoreMedio}%` },
    ],
    funil,
    pontosFortes: paraBarras(m.pontosFortes, limite),
    lacunas: paraBarras(m.lacunas, limite),
    chamada: CHAMADA_CARTAO,
    repositorio: REPOSITORIO_EXIBICAO,
    rodape: "Dados agregados e anônimos",
  };
}

/** Versão em texto, para colar nas redes. Inclui o convite para começar pelo repositório. */
export function textoCartao(c: Cartao): string {
  const linhas = [c.titulo, ""];
  for (const i of c.indicadores) linhas.push(`• ${i.valor} ${i.rotulo}`);
  if (c.pontosFortes.length) linhas.push("", `Pontos fortes: ${c.pontosFortes.map((b) => b.nome).join(", ")}`);
  if (c.lacunas.length) linhas.push(`Para estudar: ${c.lacunas.map((b) => b.nome).join(", ")}`);
  linhas.push("", `${c.chamada}: ${REPOSITORIO_URL}`, c.rodape);
  return linhas.join("\n");
}

export const ASSUNTO_CARTAO = "Minha busca de emprego em números";

export interface LinkRede {
  id: string;
  nome: string;
  href: string;
  /** Copia o texto do cartão ao clicar (LinkedIn não aceita texto pré-preenchido). */
  copiarAoClicar?: boolean;
}

const LINKEDIN_FEED = "https://www.linkedin.com/feed/?shareActive=true";

/**
 * Links de compartilhamento para as principais redes. Recebem só o texto do cartão e a
 * URL pública da página (sem query nem hash). LinkedIn aparece sempre: sem URL pública
 * (instalação local) abre o feed, e o clique copia o texto para colar na publicação.
 * Facebook só aparece com URL pública, porque só compartilha um link.
 */
export function linksCompartilhamento(texto: string, url: string | null): LinkRede[] {
  const t = encodeURIComponent(texto);
  const links: LinkRede[] = [
    {
      id: "linkedin",
      nome: "LinkedIn",
      href: url ? `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}` : LINKEDIN_FEED,
      copiarAoClicar: true,
    },
  ];
  links.push({ id: "x", nome: "X", href: `https://x.com/intent/post?text=${t}` });
  if (url) {
    links.push({ id: "facebook", nome: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` });
  }
  links.push({ id: "whatsapp", nome: "WhatsApp", href: `https://wa.me/?text=${t}` });
  links.push({
    id: "telegram",
    nome: "Telegram",
    href: url ? `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${t}` : `https://t.me/share/url?text=${t}`,
  });
  links.push({ id: "email", nome: "E-mail", href: `mailto:?subject=${encodeURIComponent(ASSUNTO_CARTAO)}&body=${t}` });
  return links;
}

const LOCAIS = /^(localhost|.*\.local|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[?::1\]?|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

/** URL pública da página, sem query string nem hash. Null quando o endereço é local (ex.: localhost). */
export function urlPublica(loc: { protocol: string; hostname: string; origin: string; pathname: string }): string | null {
  if (!/^https?:$/.test(loc.protocol) || LOCAIS.test(loc.hostname)) return null;
  return `${loc.origin}${loc.pathname}`;
}
