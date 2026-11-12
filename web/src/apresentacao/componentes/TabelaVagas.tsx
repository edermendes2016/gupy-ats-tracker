import type { Status, Vaga } from "../../dominio/tipos";
import { ROTULO_STATUS, STATUS } from "../../dominio/tipos";
import { formatarData, tomDoScore } from "../../dominio/score";
import { useAtualizarStatus } from "../../aplicacao/consultas";

interface Props {
  vagas: Vaga[];
  anonimo: boolean;
  /** Mudar o status exige o id real; no modo anônimo fica desligado. */
  editavel: boolean;
  onSelecionar: (id: string) => void;
}

export function TabelaVagas({ vagas, anonimo, editavel, onSelecionar }: Props) {
  const atualizar = useAtualizarStatus();

  if (vagas.length === 0) {
    return <p className="vazio">Nenhuma vaga encontrada.</p>;
  }

  return (
    <div className="tabela-wrap">
      <table className="tabela">
        <thead>
          <tr>
            <th>Score</th>
            <th>Empresa</th>
            <th>Cargo</th>
            <th>Data</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {vagas.map((v) => (
            <tr key={v.id}>
              <td>
                <span className={`selo selo-${tomDoScore(v.matchScore)}`}>{v.matchScore}%</span>
              </td>
              <td>
                <button className="link" onClick={() => onSelecionar(v.id)}>
                  {v.empresa}
                </button>
              </td>
              <td>{v.cargo}</td>
              <td>{formatarData(v.data)}</td>
              <td>
                {editavel && !anonimo ? (
                  <select
                    aria-label={`Status de ${v.empresa} ${v.cargo}`}
                    value={v.status}
                    disabled={atualizar.isPending}
                    onChange={(e) => atualizar.mutate({ id: v.id, status: e.target.value as Status })}
                  >
                    {STATUS.map((s) => (
                      <option key={s} value={s}>
                        {ROTULO_STATUS[s]}
                      </option>
                    ))}
                  </select>
                ) : (
                  ROTULO_STATUS[v.status]
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {atualizar.isError && <p role="alert" className="erro">{atualizar.error.message}</p>}
    </div>
  );
}
