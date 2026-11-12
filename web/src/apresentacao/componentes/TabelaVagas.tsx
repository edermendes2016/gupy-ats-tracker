import { useState } from "react";
import type { Status, Vaga } from "../../dominio/tipos";
import { ROTULO_STATUS, STATUS } from "../../dominio/tipos";
import { formatarData, tomDoScore } from "../../dominio/score";
import { useAtualizarStatus, useExcluirVaga } from "../../aplicacao/consultas";

interface Props {
  vagas: Vaga[];
  anonimo: boolean;
  /** Mudar o status exige o id real; no modo anônimo fica desligado. */
  editavel: boolean;
  onSelecionar: (id: string) => void;
  /** Mostra o botão Excluir (com confirmação). No modo anônimo, usa o id mascarado. */
  excluivel?: boolean;
}

export function TabelaVagas({ vagas, anonimo, editavel, onSelecionar, excluivel = false }: Props) {
  const atualizar = useAtualizarStatus();
  const excluir = useExcluirVaga();
  const [aConfirmar, setAConfirmar] = useState<string | null>(null);

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
            {excluivel && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {vagas.map((v) => (
            <tr key={v.id}>
              <td>
                <span className={`selo selo-${tomDoScore(v.matchScore)}`}>{v.matchScore}%</span>
              </td>
              <td>
                {anonimo ? (
                  // O id mascarado não existe no serviço, então não há detalhe para abrir.
                  v.empresa
                ) : (
                  <button className="link" onClick={() => onSelecionar(v.id)}>
                    {v.empresa}
                  </button>
                )}
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
              {excluivel && (
                <td>
                  {aConfirmar === v.id ? (
                    <span className="confirmacao">
                      <button
                        className="perigo"
                        disabled={excluir.isPending}
                        onClick={() => excluir.mutate({ id: v.id, anonimo }, { onSuccess: () => setAConfirmar(null) })}
                      >
                        Confirmar exclusão
                      </button>{" "}
                      <button onClick={() => setAConfirmar(null)}>Cancelar</button>
                    </span>
                  ) : (
                    <button
                      aria-label={`Excluir ${v.empresa} ${v.cargo}`}
                      onClick={() => setAConfirmar(v.id)}
                    >
                      Excluir
                    </button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {atualizar.isError && <p role="alert" className="erro">{atualizar.error.message}</p>}
      {excluir.isError && <p role="alert" className="erro">{excluir.error.message}</p>}
    </div>
  );
}
