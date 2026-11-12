import { useState } from "react";
import { useRanking, useVagas } from "../aplicacao/consultas";
import { TabelaVagas } from "./componentes/TabelaVagas";
import { DetalheVaga } from "./componentes/DetalheVaga";
import { FormularioVaga } from "./componentes/FormularioVaga";
import { MetricasPainel } from "./componentes/MetricasPainel";
import { ExportarPlanilha } from "./componentes/ExportarPlanilha";
import { ROTULO_STATUS, STATUS, type Status } from "../dominio/tipos";

type Aba = "ranking" | "vagas" | "metricas" | "nova";
const ABAS: Array<[Aba, string]> = [
  ["ranking", "Ranking"],
  ["vagas", "Vagas"],
  ["metricas", "Métricas"],
  ["nova", "Nova vaga"],
];

export function App() {
  const [aba, setAba] = useState<Aba>("ranking");
  const [anonimo, setAnonimo] = useState(false);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<Status | "">("");

  // Cada aba só busca os próprios dados.
  const ranking = useRanking(anonimo, aba === "ranking");
  const vagas = useVagas({ status: filtroStatus || undefined, anonimo }, aba === "vagas");

  return (
    <div className="app">
      <header className="topo">
        <h1>Gupy Tracker</h1>
        <label className="alternar">
          <input type="checkbox" checked={anonimo} onChange={(e) => setAnonimo(e.target.checked)} />
          Modo anônimo
        </label>
      </header>

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

        {aba === "nova" && (
          <section aria-label="Nova vaga">
            <FormularioVaga aoCriar={() => setAba("vagas")} />
          </section>
        )}
      </main>

      {selecionada && (
        <DetalheVaga id={selecionada} anonimo={anonimo} onFechar={() => setSelecionada(null)} />
      )}
    </div>
  );
}
