import { useState, type FormEvent } from "react";
import { useEscolherPlanilha, useExportarPlanilha, useGerarPlanilha } from "../../aplicacao/consultas";

const CHAVE = "gupy-tracker.planilha";
const DESTINO_SUGERIDO = "private/controle.xlsx";

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
  const [gerando, setGerando] = useState(false);
  const [destinoNovo, setDestinoNovo] = useState(DESTINO_SUGERIDO);

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

  function iniciarGerar() {
    setGerando(true);
  }

  function criarNovo() {
    const destino = destinoNovo.trim();
    if (!destino) return;
    // Depois de criar, o caminho escolhido vira a planilha de controle.
    gerar.mutate(destino, {
      onSuccess: (r) => {
        definir(r.caminho);
        setGerando(false);
      },
    });
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (gerando) return criarNovo(); // Enter no campo do novo arquivo cria, não exporta
    exportar.mutate(caminho.trim());
  }

  const temCaminho = caminho.trim() !== "";

  return (
    <form className="exportar" onSubmit={enviar}>
      {gerando ? (
        <label>
          Salvar a nova planilha em (caminho do .xlsx no computador onde o serviço roda)
          <input value={destinoNovo} onChange={(e) => setDestinoNovo(e.target.value)} placeholder={DESTINO_SUGERIDO} />
        </label>
      ) : temCaminho && !digitando ? (
        <p>
          Planilha de controle: <code>{caminho}</code>{" "}
          <button type="button" className="link" onClick={() => setDigitando(true)}>trocar</button>
        </p>
      ) : (
        <label>
          Caminho da planilha de controle (.xlsx no computador onde o serviço roda)
          <input value={caminho} onChange={(e) => setCaminho(e.target.value)} placeholder={DESTINO_SUGERIDO} />
        </label>
      )}

      {gerando ? (
        <>
          <button type="button" onClick={criarNovo} disabled={gerar.isPending || !destinoNovo.trim()}>
            {gerar.isPending ? "Criando…" : "Criar planilha"}
          </button>
          <button type="button" className="link" onClick={() => setGerando(false)} disabled={gerar.isPending}>
            Cancelar
          </button>
        </>
      ) : temCaminho ? (
        <button type="submit" disabled={exportar.isPending}>
          {exportar.isPending ? "Exportando…" : "Exportar planilha"}
        </button>
      ) : (
        <button type="button" onClick={abrir} disabled={escolher.isPending}>
          {escolher.isPending ? "Abrindo…" : "Abrir planilha"}
        </button>
      )}

      {!gerando && !temCaminho && (
        <button type="button" onClick={iniciarGerar}>Gerar planilha</button>
      )}
      <p className="ajuda">
        Sem planilha? "Gerar planilha" cria um .xlsx novo com o mesmo layout de colunas. Você escolhe onde salvar, e esse caminho vira o da planilha de controle.
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
