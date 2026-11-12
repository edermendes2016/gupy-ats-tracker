// Leitura do texto dos cards de "Minhas candidaturas". Função pura, sem acesso à página.
// Cada card traz a empresa na primeira linha, o cargo na segunda e "Seu Progresso X/Y".

export function extrairProgresso(texto) {
  const achado = /Seu\s+Progresso\s*(\d+)\s*\/\s*(\d+)/i.exec(texto ?? "");
  if (!achado) return null;
  const atual = Number(achado[1]);
  const total = Number(achado[2]);
  if (total < 1 || atual > total) return null;
  return { atual, total };
}

/** Lê um card a partir do texto visível dele. Devolve null se não tiver progresso ou nome. */
export function lerCartao(texto) {
  const progresso = extrairProgresso(texto);
  if (!progresso) return null;
  const linhas = (texto ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/Seu\s+Progresso/i.test(l) && !/^\d+\s*\/\s*\d+$/.test(l));
  const [empresa, cargo] = linhas;
  if (!empresa || !cargo) return null;
  return { empresa, cargo, ...progresso };
}
