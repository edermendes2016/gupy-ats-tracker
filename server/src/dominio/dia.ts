// Dia de hoje do app. As missões e a data das candidaturas usam o calendário de Brasília,
// não UTC: sem isso o "dia" vira à noite (21h de Brasília), antes da meia-noite local.
export const FUSO_DO_APP = "America/Sao_Paulo";

const formatador = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSO_DO_APP,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data AAAA-MM-DD do instante, no calendário de São Paulo. */
export function diaDeHoje(agora: Date = new Date()): string {
  return formatador.format(agora);
}
