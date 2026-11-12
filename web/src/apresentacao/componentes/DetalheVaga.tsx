import { useVaga } from "../../aplicacao/consultas";
import { CRITERIOS, ROTULO_MODELO, ROTULO_SENIORIDADE, ROTULO_STATUS } from "../../dominio/tipos";
import { formatarData, tomDoScore } from "../../dominio/score";

interface Props {
  id: string;
  anonimo: boolean;
  onFechar: () => void;
}

export function DetalheVaga({ id, anonimo, onFechar }: Props) {
  const consulta = useVaga(id, anonimo);

  return (
    <aside className="detalhe" aria-label="Detalhe da vaga">
      <button className="fechar" onClick={onFechar} aria-label="Fechar detalhe">×</button>
      {consulta.isPending && <p>Carregando…</p>}
      {consulta.isError && <p role="alert" className="erro">{consulta.error.message}</p>}
      {consulta.data && (() => {
        const v = consulta.data;
        return (
          <>
            <h2>{v.cargo}</h2>
            <p className="sub">{v.empresa} · {formatarData(v.data)}</p>
            <p>
              <span className={`selo selo-${tomDoScore(v.matchScore)}`}>{v.matchScore}%</span>{" "}
              {v.classificacao} · {ROTULO_STATUS[v.status]}
            </p>
            <dl className="ficha">
              <dt>Senioridade</dt><dd>{ROTULO_SENIORIDADE[v.senioridade]}</dd>
              <dt>Modelo</dt><dd>{v.modelo ? ROTULO_MODELO[v.modelo] : "Não informado"}</dd>
              <dt>Área</dt><dd>{v.area}</dd>
              {v.url && (<><dt>Link</dt><dd><a href={v.url} target="_blank" rel="noreferrer">Abrir vaga</a></dd></>)}
            </dl>

            <h3>Critérios</h3>
            <ul className="criterios">
              {CRITERIOS.map((c) => (
                <li key={c.nome}>
                  <span>{c.rotulo} <small>(peso {c.peso}%)</small></span>
                  <meter min={0} max={100} value={v.criterios[c.nome]}>{v.criterios[c.nome]}</meter>
                  <span className="num">{v.criterios[c.nome]}</span>
                </li>
              ))}
            </ul>

            {v.palavrasChave.length > 0 && (
              <>
                <h3>Palavras-chave</h3>
                <p>{v.palavrasChave.join(", ")}</p>
              </>
            )}
            {v.lacunas.length > 0 && (
              <>
                <h3>Lacunas</h3>
                <ul>{v.lacunas.map((l) => <li key={l}>{l}</li>)}</ul>
              </>
            )}
            {v.descricao && (<><h3>Descrição</h3><p className="texto">{v.descricao}</p></>)}
            {v.requisitos && (<><h3>Requisitos</h3><p className="texto">{v.requisitos}</p></>)}
            {v.responsabilidades && (<><h3>Responsabilidades</h3><p className="texto">{v.responsabilidades}</p></>)}

            <h3>Histórico</h3>
            <ol>
              {v.historico.map((h, i) => (
                <li key={`${h.data}-${i}`}>{formatarData(h.data)}: {ROTULO_STATUS[h.status]}</li>
              ))}
            </ol>
          </>
        );
      })()}
    </aside>
  );
}
