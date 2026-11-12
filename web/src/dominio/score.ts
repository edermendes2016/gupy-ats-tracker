// Apresentação do Match Score. A faixa define só a cor do selo; a regra é do serviço Python.

export type TomFaixa = "alta" | "boa" | "aposta" | "descartar";

export function tomDoScore(score: number): TomFaixa {
  if (score >= 80) return "alta";
  if (score >= 60) return "boa";
  if (score >= 40) return "aposta";
  return "descartar";
}

export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}
