import { useState } from "react";

/** Bloco editável de uma resposta sugerida, com contador e botão "Copiar". */
export function RespostaGupy({
  id, titulo, valor, aoMudar, limite, multilinha = false, contagem,
}: {
  id: string;
  titulo: string;
  valor: string;
  aoMudar: (novo: string) => void;
  limite?: number;
  multilinha?: boolean;
  contagem?: string;
}) {
  const [aviso, setAviso] = useState("");

  async function copiar() {
    try {
      await navigator.clipboard.writeText(valor);
      setAviso("Copiado");
    } catch {
      setAviso("Não foi possível copiar; selecione o texto e copie.");
    }
  }

  const rotuloContador = limite !== undefined
    ? `${valor.length} de ${limite} caracteres`
    : contagem ?? "";

  return (
    <div className="resposta-gupy">
      <label htmlFor={id}>{titulo}</label>
      {multilinha ? (
        <textarea id={id} rows={3} value={valor} onChange={(e) => aoMudar(e.target.value)} />
      ) : (
        <textarea id={id} rows={8} maxLength={limite} value={valor} onChange={(e) => aoMudar(e.target.value)} />
      )}
      <div className="resposta-rodape">
        <small className={limite !== undefined && valor.length > limite ? "erro" : undefined}>{rotuloContador}</small>
        <button type="button" onClick={copiar} disabled={!valor.trim()}>Copiar</button>
        <span role="status" aria-live="polite">{aviso}</span>
      </div>
    </div>
  );
}
