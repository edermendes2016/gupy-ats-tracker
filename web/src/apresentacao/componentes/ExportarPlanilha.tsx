import { useState, type FormEvent } from "react";
import { useExportarPlanilha } from "../../aplicacao/consultas";

export function ExportarPlanilha() {
  const exportar = useExportarPlanilha();
  const [caminho, setCaminho] = useState("");

  function enviar(e: FormEvent) {
    e.preventDefault();
    exportar.mutate(caminho);
  }

  return (
    <form className="exportar" onSubmit={enviar}>
      <label>
        Planilha de controle (.xlsx no computador onde o serviço roda)
        <input value={caminho} onChange={(e) => setCaminho(e.target.value)} placeholder="private/controle.xlsx" required />
      </label>
      <button type="submit" disabled={exportar.isPending || caminho.trim() === ""}>
        {exportar.isPending ? "Exportando…" : "Exportar planilha"}
      </button>
      {exportar.isSuccess && (
        <p role="status">{exportar.data.novas} vaga(s) adicionada(s), {exportar.data.existentes} já estavam lá.</p>
      )}
      {exportar.isError && <p role="alert" className="erro">{exportar.error.message}</p>}
    </form>
  );
}
