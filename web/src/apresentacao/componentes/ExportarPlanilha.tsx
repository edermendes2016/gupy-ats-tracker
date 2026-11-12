import { useState, type FormEvent } from "react";
import { useEscolherPlanilha, useExportarPlanilha, useGerarPlanilha } from "../../aplicacao/consultas";

const CHAVE = "gupy-tracker.planilha";

/** Último caminho usado neste navegador. Só uma conveniência: se falhar, a tela segue sem ele. */
function caminhoGuardado(): string {
  try {
    return window.localStorage.getItem(CHAVE) ?? "";
  } catch {
    return "";
  }
}

function guardarCaminho(caminho: string) {
  try {
    window.localStorage.setItem(CHAVE, caminho);
  } catch {
    /* sem armazenamento local: o caminho vale só nesta sessão */
  }
}

export function ExportarPlanilha() {
  const exportar = useExportarPlanilha();
  const escolher = useEscolherPlanilha();
  const gerar = useGerarPlanilha();
  const [caminho, setCaminho] = useState(caminhoGuardado);
  const [digitando, setDigitando] = useState(false);

  function definir(novo: string) {
    setCaminho(novo);
    guardarCaminho(novo);
    setDigitando(false);
  }

  function abrir() {
    escolher.mutate(undefined, {
      onSuccess: (r) => {
        if (r) definir(r.caminho);
      },
      onError: () => setDigitando(true),
    });
  }

  function gerarNovo() {
    const destino = caminho.trim() || "private/controle.xlsx";
    gerar.mutate(destino, { onSuccess: (r) => definir(r.caminho) });
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    exportar.mutate(caminho.trim());
  }

  const temCaminho = caminho.trim() !== "";

  return (
    <form className="exportar" onSubmit={enviar}>
      {temCaminho && !digitando ? (
        <p>
          Planilha de controle: <code>{caminho}</code>{" "}
          <button type="button" className="link" onClick={() => setDigitando(true)}>trocar</button>
        </p>
      ) : (
        <label>
          Caminho da planilha de controle (.xlsx no computador onde o serviço roda)
          <input value={caminho} onChange={(e) => setCaminho(e.target.value)} placeholder="private/controle.xlsx" />
        </label>
      )}

      {temCaminho ? (
        <button type="submit" disabled={exportar.isPending}>
          {exportar.isPending ? "Exportando…" : "Exportar planilha"}
        </button>
      ) : (
        <button type="button" onClick={abrir} disabled={escolher.isPending}>
          {escolher.isPending ? "Abrindo…" : "Abrir planilha"}
        </button>
      )}

      {!temCaminho && (
        <button type="button" onClick={gerarNovo} disabled={gerar.isPending}>
          {gerar.isPending ? "Gerando…" : "Gerar planilha"}
        </button>
      )}
      <p className="ajuda">
        Sem planilha? "Gerar planilha" cria um .xlsx novo com o mesmo layout de colunas e já deixa esse caminho como o da planilha de controle.
      </p>

      {exportar.isSuccess && (
        <p role="status">{exportar.data.novas} vaga(s) adicionada(s), {exportar.data.existentes} já estavam lá (colunas atualizadas).</p>
      )}
      {(exportar.isError || escolher.isError || gerar.isError) && (
        <p role="alert" className="erro">
          {(exportar.error ?? escolher.error ?? gerar.error)?.message}
          {escolher.isError && " Digite o caminho manualmente."}
        </p>
      )}
    </form>
  );
}
