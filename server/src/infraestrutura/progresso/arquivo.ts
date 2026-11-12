// Progresso das etapas guardado num JSON local (private/, fora do Git).
// Chave: id da vaga no serviço Python. Valor: { atual, total }.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ProgressoRepositorio } from "../../aplicacao/portas.js";
import type { ProgressoEtapas } from "../../dominio/aventura.js";

export function criarProgressoArquivo(caminho: string): ProgressoRepositorio {
  async function ler(): Promise<Record<string, ProgressoEtapas>> {
    try {
      return JSON.parse(await readFile(caminho, "utf8")) as Record<string, ProgressoEtapas>;
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw erro;
    }
  }

  return {
    ler,
    async salvar(id, progresso) {
      const atuais = await ler();
      atuais[id] = progresso;
      await mkdir(dirname(caminho), { recursive: true });
      await writeFile(caminho, JSON.stringify(atuais, null, 2), "utf8");
    },
  };
}
