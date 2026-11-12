// Apresentação do Match Score. A faixa define só a cor do selo; a regra é do serviço Python.

export type TomFaixa = "alta" | "boa" | "aposta" | "descartar";

export function tomDoScore(score: number): TomFaixa {
  if (score >= 80) return "alta";
  if (score >= 60) return "boa";
  if (score >= 40) return "aposta";
  return "descartar";
}

/** Cor do selo do Match Score: verde a partir de 70, âmbar de 50 a 69, vermelho abaixo de 50. */
export type CorSelo = "verde" | "ambar" | "vermelho";

export function corDoSelo(score: number): CorSelo {
  if (score >= 70) return "verde";
  if (score >= 50) return "ambar";
  return "vermelho";
}

export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}
