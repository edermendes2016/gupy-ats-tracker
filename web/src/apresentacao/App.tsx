import { useState } from "react";
import { useRanking, useVagas } from "../aplicacao/consultas";
import { TabelaVagas } from "./componentes/TabelaVagas";
import { DetalheVaga } from "./componentes/DetalheVaga";
import { FormularioVaga } from "./componentes/FormularioVaga";
import { MetricasPainel } from "./componentes/MetricasPainel";
import { ExportarPlanilha } from "./componentes/ExportarPlanilha";
import { AventuraPainel } from "./componentes/AventuraPainel";
import { ConquistasPainel } from "./componentes/ConquistasPainel";
import { PASSOS_TUTORIAL, Tutorial, marcarTutorialVisto, tutorialJaVisto } from "./componentes/Tutorial";
import { ROTULO_STATUS, STATUS, type Status } from "../dominio/tipos";

type Aba = "ranking" | "vagas" | "metricas" | "aventura" | "conquistas" | "nova";
const ABAS: Array<[Aba, string]> = [
  ["ranking", "Ranking"],
  ["vagas", "Vagas"],
  ["metricas", "Métricas"],
  ["aventura", "Aventura"],
  ["conquistas", "Conquistas"],
  ["nova", "Nova vaga"],
];

export function App() {
  const [aba, setAba] = useState<Aba>("ranking");
  const [anonimo, setAnonimo] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<Status | "">("");
  // Tour de primeiro uso: abre sozinho só na primeira visita; "Tutorial" no topo reabre.
  const [passoTutorial, setPassoTutorial] = useState<number | null>(() => (tutorialJaVisto() ? null : 0));

  function irParaPassoTutorial(passo: number) {
    setPassoTutorial(passo);
    setAba(PASSOS_TUTORIAL[passo]!.aba);
  }

  function fecharTutorial() {
    marcarTutorialVisto();
    setPassoTutorial(null);
    setAba("ranking");
  }

  // Cada aba só busca os próprios dados.
  const ranking = useRanking(anonimo, aba === "ranking");
  const vagas = useVagas({ status: filtroStatus || undefined, anonimo }, aba === "vagas");

  return (
    <div className="app">
      <header className="topo">
        <h1>Gupy Tracker</h1>
        <nav className="abas" role="tablist">
        {ABAS.map(([id, rotulo]) => (
          <button
            key={id}
            role="tab"
            aria-selected={aba === id}
            className={aba === id ? "ativa" : ""}
            onClick={() => setAba(id)}
          >
            {rotulo}
          </button>
        ))}
        </nav>
        <label className="alternar">
          <input type="checkbox" role="switch" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} />
          Modo anônimo
        </label>
        <button type="button" className="rever-tutorial" onClick={() => irParaPassoTutorial(0)}>
          Tutorial
        </button>
      </header>

      <main className="conteudo">
        {aba === "ranking" && (
          <section aria-label="Ranking">
            <p className="ajuda">Vagas ordenadas pelo Match Score. Clique na empresa para ver os detalhes.</p>
            {ranking.isPending && <p>Carregando…</p>}
            {ranking.isError && <p role="alert" className="erro">{ranking.error.message}</p>}
            {ranking.data && (
              <TabelaVagas vagas={ranking.data} anonimo={anonimo} editavel={false} excluivel onSelecionar={setSelecionada} />
            )}
          </section>
        )}

        {aba === "vagas" && (
          <section aria-label="Vagas">
            <div className="barra">
              <label>
                Status
                <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value as Status | "")}>
                  <option value="">Todos</option>
                  {STATUS.map((s) => <option key={s} value={s}>{ROTULO_STATUS[s]}</option>)}
                </select>
              </label>
              {anonimo && <span className="aviso">Modo anônimo: o status não pode ser alterado.</span>}
            </div>
            {vagas.isPending && <p>Carregando…</p>}
            {vagas.isError && <p role="alert" className="erro">{vagas.error.message}</p>}
            {vagas.data && (
              <TabelaVagas vagas={vagas.data} anonimo={anonimo} editavel onSelecionar={setSelecionada} />
            )}
            {!anonimo && <ExportarPlanilha />}
          </section>
        )}

        {aba === "metricas" && <MetricasPainel anonimo={anonimo} />}

        {aba === "aventura" && <AventuraPainel anonimo={anonimo} />}

        {aba === "conquistas" && <ConquistasPainel anonimo={anonimo} />}

        {aba === "nova" && (
          <section aria-label="Nova vaga">
            <FormularioVaga aoCriar={() => setAba("vagas")} />
          </section>
        )}
      </main>

      {passoTutorial !== null && (
        <Tutorial passo={passoTutorial} aoMudarPasso={irParaPassoTutorial} aoFechar={fecharTutorial} />
      )}

      {selecionada && (
        <DetalheVaga id={selecionada} anonimo={anonimo} onFechar={() => setSelecionada(null)} />
      )}
    </div>
  );
}
