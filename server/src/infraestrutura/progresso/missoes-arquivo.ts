// Marcações das missões diárias num JSON local (private/, fora do Git).
// Só guarda a data e um sim ou não por missão manual.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MissoesRepositorio } from "../../aplicacao/portas.js";
import type { RegistroDia } from "../../dominio/missoes.js";

export function criarMissoesArquivo(caminho: string): MissoesRepositorio {
  async function ler(): Promise<Record<string, RegistroDia>> {
    try {
      return JSON.parse(await readFile(caminho, "utf8")) as Record<string, RegistroDia>;
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw erro;
    }
  }

  return {
    ler,
    async marcar(dia, missao, feita) {
      const atuais = await ler();
      atuais[dia] = { ...atuais[dia], [missao]: feita };
      await mkdir(dirname(caminho), { recursive: true });
      await writeFile(caminho, JSON.stringify(atuais, null, 2), "utf8");
    },
  };
}
