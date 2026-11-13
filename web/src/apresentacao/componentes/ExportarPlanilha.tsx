import { useState, type FormEvent } from "react";
import {
  useEscolherPasta,
  useEscolherPlanilha,
  useExportarPlanilha,
  useGerarPlanilha,
  usePlanilhasDisponiveis,
} from "../../aplicacao/consultas";

const CHAVE = "gupy-tracker.planilha";
const CHAVE_PASTA = "gupy-tracker.pasta";
const DESTINO_SUGERIDO = "private/controle.xlsx";
const NOME_SUGERIDO = "controle";

/** Último valor usado neste navegador. Só uma conveniência: se falhar, a tela segue sem ele. */
function lerGuardado(chave: string): string {
  try {
    return window.localStorage.getItem(chave) ?? "";
  } catch {
    return "";
  }
}

function guardar(chave: string, valor: string) {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    /* sem armazenamento local: o valor vale só nesta sessão */
  }
}

export function ExportarPlanilha() {
  const exportar = useExportarPlanilha();
  const escolher = useEscolherPlanilha();
  const escolherPasta = useEscolherPasta();
  const gerar = useGerarPlanilha();
  const [caminho, setCaminho] = useState(() => lerGuardado(CHAVE));
  const [digitando, setDigitando] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [pastaNova, setPastaNova] = useState(() => lerGuardado(CHAVE_PASTA));
  const [nomeNovo, setNomeNovo] = useState(NOME_SUGERIDO);
  const [escolhendo, setEscolhendo] = useState(false);
  const disponiveis = usePlanilhasDisponiveis(escolhendo);

  function definir(novo: string) {
    setCaminho(novo);
    guardar(CHAVE, novo);
    setDigitando(false);
  }

  function abrir() {
    // Com seletor nativo (Windows) abre a janela; sem ele, lista as planilhas da pasta configurada.
    escolher.mutate(undefined, {
      onSuccess: (r) => {
        if (r) definir(r.caminho);
      },
      onError: () => setEscolhendo(true),
    });
  }

  function escolherDaLista(caminhoEscolhido: string) {
    definir(caminhoEscolhido);
    setEscolhendo(false);
  }

  function escolherPastaNova() {
    escolherPasta.mutate(undefined, {
      onSuccess: (r) => {
        if (r) setPastaNova(r.caminho);
      },
    });
  }

  function iniciarGerar() {
    setGerando(true);
  }

  function criarNovo() {
    const pasta = pastaNova.trim();
    const nome = nomeNovo.trim();
    if (!pasta || !nome) return;
    // Depois de criar, o caminho escolhido vira a planilha de controle.
    gerar.mutate({ pasta, nome }, {
      onSuccess: (r) => {
        guardar(CHAVE_PASTA, pasta);
        definir(r.caminho);
        setGerando(false);
      },
    });
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (gerando) return criarNovo(); // Enter no campo do nome cria, não exporta
    exportar.mutate(caminho.trim());
  }

  const temCaminho = caminho.trim() !== "";
  const podeCriar = pastaNova.trim() !== "" && nomeNovo.trim() !== "";

  return (
    <form className="exportar" onSubmit={enviar}>
      {gerando ? (
        <>
          <label>
            Pasta onde criar a planilha (no computador onde o serviço roda)
            <span className="linha-campo">
              <input
                value={pastaNova}
                onChange={(e) => setPastaNova(e.target.value)}
                placeholder="ex.: C:\Users\voce\Documents"
              />
              <button type="button" onClick={escolherPastaNova} disabled={escolherPasta.isPending}>
                {escolherPasta.isPending ? "Abrindo…" : "Escolher pasta"}
              </button>
            </span>
          </label>
          <label>
            Nome do arquivo
            <span className="linha-campo">
              <input
                value={nomeNovo}
                onChange={(e) => setNomeNovo(e.target.value)}
                placeholder={NOME_SUGERIDO}
                aria-describedby="sufixo-xlsx"
              />
              <span id="sufixo-xlsx" className="sufixo">.xlsx</span>
            </span>
          </label>
        </>
      ) : escolhendo ? (
        <div className="lista-planilhas">
          {disponiveis.isPending && <p>Carregando planilhas…</p>}
          {disponiveis.isError && (
            <p className="erro" role="alert">{disponiveis.error.message} Digite o caminho manualmente.</p>
          )}
          {disponiveis.isSuccess && disponiveis.data.length === 0 && (
            <p>Nenhum arquivo .xlsx na pasta de planilhas. Coloque a planilha lá ou digite o caminho.</p>
          )}
          {disponiveis.isSuccess && disponiveis.data.length > 0 && (
            <>
              <p>Escolha a planilha de controle:</p>
              <ul>
                {disponiveis.data.map((p) => (
                  <li key={p.caminho}>
                    <button type="button" className="link" onClick={() => escolherDaLista(p.caminho)}>
                      {p.nome}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <button type="button" className="link" onClick={() => { setEscolhendo(false); setDigitando(true); }}>
            digitar o caminho
          </button>
        </div>
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
          <button type="button" onClick={criarNovo} disabled={gerar.isPending || !podeCriar}>
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
      ) : escolhendo ? (
        <button type="button" className="link" onClick={() => setEscolhendo(false)}>Cancelar</button>
      ) : (
        <button type="button" onClick={abrir} disabled={escolher.isPending}>
          {escolher.isPending ? "Abrindo…" : "Abrir planilha"}
        </button>
      )}

      {!gerando && !temCaminho && (
        <button type="button" onClick={iniciarGerar}>Gerar planilha</button>
      )}
      <p className="ajuda">
        Sem planilha? "Gerar planilha" cria um .xlsx novo com o mesmo layout de colunas. Escolha a pasta e digite só o nome: o .xlsx é acrescentado sozinho, e a planilha nunca substitui uma existente.
      </p>

      {exportar.isSuccess && (
        <p role="status">{exportar.data.novas} vaga(s) adicionada(s), {exportar.data.existentes} já estavam lá (colunas atualizadas).</p>
      )}
      {(exportar.isError || escolherPasta.isError || gerar.isError) && (
        <p role="alert" className="erro">
          {(exportar.error ?? escolherPasta.error ?? gerar.error)?.message}
          {escolherPasta.isError && " Digite a pasta manualmente."}
        </p>
      )}
    </form>
  );
}
