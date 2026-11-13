// Monta o caminho de uma planilha nova a partir de uma pasta e de um nome digitado.
// A pessoa digita só o nome; a extensão .xlsx é sempre acrescentada aqui, no servidor.
import path from "node:path";
import { ErroEntradaInvalida } from "./erros.js";

const EXTENSAO = ".xlsx";
const MAXIMO_NOME = 120;
// Caracteres que não podem aparecer num nome de arquivo (Windows e POSIX): inclui separadores de pasta.
const CARACTERES_PROIBIDOS = /[<>:"/\\|?*\u0000-\u001f]/;
const NOMES_RESERVADOS_WINDOWS = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;

/** Devolve `pasta/nome.xlsx`. Lança ErroEntradaInvalida se a pasta ou o nome forem inválidos. */
export function montarCaminhoXlsx(pasta: string, nome: string): string {
  const diretorio = pasta.trim();
  if (!diretorio) throw new ErroEntradaInvalida("escolha a pasta onde criar a planilha");

  // Quem digita "controle.xlsx" não ganha "controle.xlsx.xlsx".
  const base = nome.trim().replace(/\.xlsx$/i, "").trim();
  if (!base) throw new ErroEntradaInvalida("digite o nome do arquivo");
  if (base.length > MAXIMO_NOME) throw new ErroEntradaInvalida(`o nome passa de ${MAXIMO_NOME} caracteres`);
  if (CARACTERES_PROIBIDOS.test(base)) {
    throw new ErroEntradaInvalida('o nome não pode ter / \\ : * ? " < > | — digite só o nome, sem pasta');
  }
  if (base === "." || base === ".." || base.endsWith(".")) {
    throw new ErroEntradaInvalida("nome de arquivo inválido");
  }
  if (NOMES_RESERVADOS_WINDOWS.test(base)) throw new ErroEntradaInvalida(`"${base}" é um nome reservado do Windows`);

  return path.join(diretorio, base + EXTENSAO);
}
