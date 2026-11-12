import { describe, expect, it } from "vitest";
import { CHAMADA_CARTAO, REPOSITORIO_URL, linksCompartilhamento, montarCartao, textoCartao, urlPublica } from "../src/dominio/cartao";
import type { Metricas } from "../src/dominio/tipos";

const METRICAS: Metricas = {
  total: 10, enviadas: 6, chegaramEntrevista: 2, taxaConversao: 0.33, ofertas: 0, scoreMedio: 58,
  porStatus: [{ status: "entrevista", vagas: 2 }],
  faixas: [{ faixa: "80-100", enviadas: 3, entrevistas: 1 }],
  evolucao: [{ mes: "2026-02", analisadas: 10, enviadas: 6, entrevistas: 2 }],
  pontosFortes: [
    { nome: "Python", vagas: 7 }, { nome: "Docker", vagas: 4 }, { nome: "SQL Server", vagas: 3 },
    { nome: "AWS", vagas: 2 }, { nome: "Git", vagas: 2 }, { nome: "Vue.js", vagas: 1 },
  ],
  lacunas: [{ nome: "Kubernetes", vagas: 5 }],
};

describe("cartão de compartilhamento", () => {
  it("usa só agregados e limita os termos", () => {
    const c = montarCartao(METRICAS);
    expect(c.indicadores.find((i) => i.rotulo === "conversão em entrevista")?.valor).toBe("33%");
    expect(c.pontosFortes).toHaveLength(5);
    expect(c.pontosFortes[0]).toEqual({ nome: "Python", valor: 7 });
    expect(c.lacunas).toEqual([{ nome: "Kubernetes", valor: 5 }]);
  });

  it("funil só traz etapas com vagas, na ordem do fluxo", () => {
    const c = montarCartao(METRICAS);
    expect(c.funil).toEqual([{ nome: "Entrevista", valor: 2 }]);
  });

  it("funil cabe no cartão: no máximo cinco etapas, na ordem do fluxo", () => {
    const todas = montarCartao({
      ...METRICAS,
      porStatus: [
        { status: "analisada", vagas: 1 }, { status: "descartada", vagas: 9 }, { status: "candidatada", vagas: 8 },
        { status: "triagem", vagas: 7 }, { status: "teste", vagas: 6 }, { status: "entrevista", vagas: 5 },
        { status: "oferta", vagas: 4 }, { status: "recusada", vagas: 3 }, { status: "desistencia", vagas: 2 },
      ],
    });
    expect(todas.funil.map((b) => b.nome)).toEqual(["Descartada", "Candidatada", "Triagem", "Teste", "Entrevista"]);
  });

  it("não contém empresa, link de vaga, id nem data completa", () => {
    const texto = textoCartao(montarCartao({ ...METRICAS }));
    expect(texto).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(texto).not.toMatch(/Empresa|gupy\.io/i);
    expect(texto).toContain("Pontos fortes: Python");
  });

  it("termina com o convite para começar pelo repositório, e só ele é link", () => {
    const texto = textoCartao(montarCartao({ ...METRICAS }));
    expect(texto).toContain(`${CHAMADA_CARTAO}: ${REPOSITORIO_URL}`);
    expect(texto.match(/https?:\/\//g)).toHaveLength(1);
  });
});

describe("links de compartilhamento", () => {
  const texto = textoCartao(montarCartao(METRICAS));
  const links = linksCompartilhamento(texto, "https://exemplo.test/app");

  it("oferece as redes pedidas", () => {
    expect(links.map((l) => l.id)).toEqual(["linkedin", "x", "facebook", "whatsapp", "telegram", "email"]);
    expect(links.find((l) => l.id === "linkedin")?.href).toBe(
      "https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fexemplo.test%2Fapp",
    );
  });

  it("codifica o texto e a URL sem perder conteúdo", () => {
    const x = links.find((l) => l.id === "x")!;
    expect(new URL(x.href).searchParams.get("text")).toBe(texto);
    const fb = links.find((l) => l.id === "facebook")!;
    expect(new URL(fb.href).searchParams.get("u")).toBe("https://exemplo.test/app");
  });

  it("e-mail usa assunto e corpo", () => {
    const mail = links.find((l) => l.id === "email")!;
    expect(mail.href.startsWith("mailto:?subject=")).toBe(true);
    expect(decodeURIComponent(mail.href).endsWith(texto)).toBe(true);
  });

  it("urlPublica descarta query e hash", () => {
    expect(urlPublica({ protocol: "https:", hostname: "a.test", origin: "https://a.test", pathname: "/x" })).toBe("https://a.test/x");
  });

  it("urlPublica ignora endereços locais", () => {
    for (const hostname of ["localhost", "127.0.0.1", "192.168.0.10", "10.0.0.2", "172.20.1.1"]) {
      expect(urlPublica({ protocol: "http:", hostname, origin: `http://${hostname}`, pathname: "/" })).toBeNull();
    }
  });

  it("sem URL pública, Facebook some, mas LinkedIn continua e abre o feed com cópia do texto", () => {
    const sem = linksCompartilhamento(texto, null);
    expect(sem.map((l) => l.id)).toEqual(["linkedin", "x", "whatsapp", "telegram", "email"]);
    const li = sem.find((l) => l.id === "linkedin")!;
    expect(li.href).toBe("https://www.linkedin.com/feed/?shareActive=true");
    expect(li.copiarAoClicar).toBe(true);
  });

  it("só o LinkedIn copia o texto ao clicar", () => {
    expect(links.filter((l) => l.copiarAoClicar).map((l) => l.id)).toEqual(["linkedin"]);
  });
});
