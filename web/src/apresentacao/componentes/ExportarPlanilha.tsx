import { useState, type ChangeEvent } from "react";
import { useAtualizarPlanilha } from "../../aplicacao/consultas";

const LIMITE_BYTES = 5 * 1024 * 1024;
const TIPO_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const PASSOS_TUTORIAL = [
  'Clique em "Baixar modelo" e salve o arquivo. Ele já tem as colunas e o formato certos.',
  "Abra o arquivo no Excel ou no Google Planilhas. Não renomeie nem apague as colunas da linha 2 (o cabeçalho).",
  'Clique em "Enviar planilha preenchida" e escolha o arquivo. O sistema acrescenta as vagas do ranking, sem duplicar as que já estão lá.',
  'Clique em "Baixar planilha atualizada" e use essa versão como sua planilha de controle.',
  "Se enviar outro arquivo, por exemplo um PDF ou uma planilha de outro modelo, o sistema recusa e explica o motivo.",
];

/** Lê o arquivo como base64 (sem o prefixo "data:...;base64,"). */
function lerBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(new Error("não foi possível ler o arquivo escolhido"));
    leitor.readAsDataURL(arquivo);
  });
}

function blobDeBase64(base64: string): Blob {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: TIPO_XLSX });
}

interface Resultado {
  novas: number;
  existentes: number;
  url: string;
  nomeDownload: string;
}

export function ExportarPlanilha() {
  const atualizar = useAtualizarPlanilha();
  const [tutorialAberto, setTutorialAberto] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  function trocarResultado(novo: Resultado | null) {
    if (resultado) URL.revokeObjectURL(resultado.url);
    setResultado(novo);
  }

  async function enviar(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = ""; // permite enviar o mesmo arquivo de novo
    if (!arquivo) return;
    setErroLocal(null);
    trocarResultado(null);

    if (!/\.xlsx$/i.test(arquivo.name)) {
      setErroLocal("Esse arquivo não é uma planilha .xlsx. Baixe o modelo, preencha e envie esse arquivo.");
      return;
    }
    if (arquivo.size === 0) {
      setErroLocal("O arquivo está vazio. Envie a planilha de controle preenchida.");
      return;
    }
    if (arquivo.size > LIMITE_BYTES) {
      setErroLocal("O arquivo passa de 5 MB. Envie a planilha de controle, não outro arquivo.");
      return;
    }

    const base64 = await lerBase64(arquivo);
    atualizar.mutate(base64, {
      onSuccess: (r) => {
        const nomeBase = arquivo.name.replace(/\.xlsx$/i, "");
        trocarResultado({
          novas: r.novas,
          existentes: r.existentes,
          url: URL.createObjectURL(blobDeBase64(r.arquivoBase64)),
          nomeDownload: `${nomeBase} atualizada.xlsx`,
        });
      },
    });
  }

  const erro = erroLocal ?? (atualizar.isError ? atualizar.error.message : null);

  return (
    <section className="exportar planilha-controle" aria-labelledby="titulo-planilha">
      <h3 id="titulo-planilha">Planilha de controle</h3>
      <p className="ajuda">
        Baixe o modelo, preencha e envie de volta. As vagas do ranking são acrescentadas à sua planilha, sem duplicar.
      </p>

      <div className="acoes-planilha">
        <a className="botao-planilha" href="/api/planilha/modelo" download="modelo-planilha-controle.xlsx">
          Baixar modelo
        </a>
        <label className="botao-planilha">
          {atualizar.isPending ? "Enviando…" : "Enviar planilha preenchida"}
          <input
            type="file"
            accept=".xlsx"
            hidden
            disabled={atualizar.isPending}
            onChange={enviar}
          />
        </label>
        <button
          type="button"
          className="link"
          aria-expanded={tutorialAberto}
          aria-controls="tutorial-planilha"
          onClick={() => setTutorialAberto((aberto) => !aberto)}
        >
          {tutorialAberto ? "Fechar tutorial" : "Tutorial"}
        </button>
      </div>

      {tutorialAberto && (
        <ol id="tutorial-planilha" className="tutorial-planilha">
          {PASSOS_TUTORIAL.map((passo) => (
            <li key={passo}>{passo}</li>
          ))}
        </ol>
      )}

      {erro && <p role="alert" className="erro">{erro}</p>}

      {resultado && (
        <p role="status">
          {resultado.novas} vaga(s) adicionada(s), {resultado.existentes} já estavam lá.{" "}
          <a className="botao-planilha" href={resultado.url} download={resultado.nomeDownload}>
            Baixar planilha atualizada
          </a>
        </p>
      )}
    </section>
  );
}
