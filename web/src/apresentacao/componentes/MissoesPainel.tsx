// Missões de hoje: candidaturas saem sozinhas das vagas; estudo e reforço são marcados à mão.
// Não tem empresa nem cargo, então vale igual no modo anônimo.
import { useMarcarMissao, useMissoes } from "../../aplicacao/consultas";
import type { Missao } from "../../dominio/tipos";

const dataCurta = (dia: string) => {
  const [, mes, d] = dia.split("-");
  return `${d}/${mes}`;
};

function ItemAutomatico({ missao }: { missao: Missao }) {
  return (
    <>
      <div className="barra-xp fina" role="progressbar" aria-label={missao.titulo} aria-valuemin={0}
        aria-valuemax={missao.meta} aria-valuenow={missao.progresso}>
        <span style={{ width: `${Math.round((100 * missao.progresso) / missao.meta)}%` }} />
      </div>
      <span className="missao-andamento">{missao.progresso} de {missao.meta}</span>
    </>
  );
}

function ItemManual({ id, feita, pendente, aoMarcar }: {
  id: "estudo" | "reforco"; feita: boolean; pendente: boolean;
  aoMarcar: (id: "estudo" | "reforco", feita: boolean) => void;
}) {
  return (
    <label className="missao-marca">
      <input type="checkbox" checked={feita} disabled={pendente} onChange={(e) => aoMarcar(id, e.target.checked)} />
      {feita ? "Feito hoje" : "Marcar como feito"}
    </label>
  );
}

export function MissoesPainel() {
  const missoes = useMissoes();
  const marcar = useMarcarMissao();

  if (missoes.isPending) return <p>Carregando missões…</p>;
  if (missoes.isError) return <p role="alert" className="erro">{missoes.error.message}</p>;
  const { dia, missoes: lista } = missoes.data;
  const feitas = lista.filter((m) => m.concluida).length;

  return (
    <section aria-label="Missões de hoje" className="missoes">
      <h3>
        Missões de hoje <span className="ajuda">({dataCurta(dia)} · {feitas} de {lista.length})</span>
      </h3>
      <ul className="missoes-lista">
        {lista.map((m) => {
          const { id } = m;
          return (
            <li key={id} className={m.concluida ? "missao feita" : "missao"}>
              <div className="missao-texto">
                <p className="missao-titulo">
                  {m.concluida && <span aria-hidden="true">✔ </span>}
                  {m.titulo}
                  {m.concluida && <span className="sr-only"> (concluída)</span>}
                </p>
                <p className="ajuda">{m.descricao}</p>
              </div>
              <div className="missao-acao">
                {id === "candidaturas" ? (
                  <ItemAutomatico missao={m} />
                ) : (
                  <ItemManual
                    id={id}
                    feita={m.concluida}
                    pendente={marcar.isPending}
                    aoMarcar={(missao, feita) => marcar.mutate({ id: missao, feita })}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {marcar.isError && <p role="alert" className="erro">{marcar.error.message}</p>}
    </section>
  );
}


