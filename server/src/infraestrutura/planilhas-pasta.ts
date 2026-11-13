// Lista as planilhas .xlsx de uma pasta configurada (a pasta montada no Docker, por exemplo).
// Serve para o caso em que o navegador não consegue dar o caminho do arquivo.
import { readdir } from "node:fs/promises";
import path from "node:path";

export interface PlanilhaDisponivel {
  nome: string;
  caminho: string;
}

export async function listarPlanilhasNaPasta(pasta: string): Promise<PlanilhaDisponivel[]> {
  const itens = await readdir(pasta, { withFileTypes: true });
  return itens
    // "~$..." são arquivos temporários que o Excel cria enquanto a planilha está aberta.
    .filter((i) => i.isFile() && /\.xlsx$/i.test(i.name) && !i.name.startsWith("~$"))
    .map((i) => ({ nome: i.name, caminho: path.join(pasta, i.name) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
