import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listarPlanilhasNaPasta } from "../src/infraestrutura/planilhas-pasta.js";

describe("listarPlanilhasNaPasta", () => {
  it("lista só os .xlsx da pasta, sem temporários do Excel nem subpastas", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "planilhas-"));
    await writeFile(path.join(dir, "b.xlsx"), "");
    await writeFile(path.join(dir, "a.XLSX"), "");
    await writeFile(path.join(dir, "notas.txt"), "");
    await writeFile(path.join(dir, "~$b.xlsx"), "");
    await mkdir(path.join(dir, "pasta.xlsx"));
    const lista = await listarPlanilhasNaPasta(dir);
    expect(lista.map((p) => p.nome)).toEqual(["a.XLSX", "b.xlsx"]);
    expect(lista[1].caminho).toBe(path.join(dir, "b.xlsx"));
  });
});
