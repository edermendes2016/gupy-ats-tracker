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
