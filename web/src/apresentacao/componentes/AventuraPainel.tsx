// Aba Aventura: o personagem sobe de nível sozinho, a partir das vagas cadastradas.
// Não precisa digitar nada: o XP vem do status e das datas da aba Vagas.
// O formulário de etapa à mão fica escondido em "Opções avançadas".
// No modo anônimo, a lista por vaga não aparece.
import { useState, type FormEvent } from "react";
import { useAventura, useRegistrarProgresso } from "../../aplicacao/consultas";

const pct = (parte: number, todo: number) => (todo > 0 ? Math.min(100, Math.round((100 * parte) / todo)) : 0);

export function AventuraPainel({ anonimo }: { anonimo: boolean }) {
  const aventura = useAventura(anonimo);
  const registrar = useRegistrarProgresso();
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [atual, setAtual] = useState("");
  const [total, setTotal] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);

  function enviar(e: FormEvent) {
    e.preventDefault();
    setAviso(null);
    registrar.mutate(
      { empresa, cargo, atual: Number(atual), total: Number(total) },
      {
        onSuccess: () => setAviso("Progresso salvo."),
        onError: (erro) => setAviso(erro.message),
      },
    );
  }

  if (aventura.isPending) return <p>Carregando…</p>;
  if (aventura.isError) return <p role="alert" className="erro">{aventura.error.message}</p>;
  const a = aventura.data;
  const andamento = pct(a.xp - a.xpNivelAtual, a.xpProximoNivel - a.xpNivelAtual);
  const maiorXp = Math.max(1, ...a.vagas.map((v) => v.xp));

  return (
    <section aria-label="Aventura" className="aventura">
      <p className="ajuda">
        Seu personagem sobe de nível enquanto as vagas esperam resposta. O XP vem do status e das datas
        da aba Vagas: quanto mais tempo numa etapa que rende, mais XP. Não há ranking.
      </p>

      <div className="aventura-cartao">
        <div className="aventura-cabeca">
          <span className="aventura-selo" aria-label={`Nível ${a.nivel}`}>{a.nivel}</span>
          <div>
            <p className="aventura-rotulo">Nível {a.nivel}</p>
            <p className="aventura-titulo">{a.titulo}</p>
          </div>
        </div>
        <div
          className="barra-xp"
          role="progressbar"
          aria-label="Progresso até o próximo nível"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={andamento}
        >
          <span style={{ width: `${andamento}%` }} />
        </div>
        <p className="aventura-xp">
          <strong>{a.xp}</strong> XP · próximo nível em {a.xpProximoNivel} XP
        </p>
      </div>

      {!anonimo && (
        <>
          <h3>XP por vaga</h3>
          {a.vagas.length === 0 ? (
            <p className="ajuda">Cadastre vagas na aba Vagas para o personagem começar a subir.</p>
          ) : (
            <ul className="aventura-vagas">
              {a.vagas.map((v) => (
                <li key={v.id}>
                  <div className="aventura-vaga-texto">
                    <span className="aventura-vaga-nome">{v.empresa}</span>
                    <span className="ajuda">{v.cargo}</span>
                  </div>
                  <div className="barra-xp fina" aria-hidden="true">
                    <span style={{ width: `${pct(v.xp, maiorXp)}%` }} />
                  </div>
                  <strong className="aventura-vaga-xp">{v.xp} XP</strong>
                </li>
              ))}
            </ul>
          )}

          <details className="avancado">
            <summary>Opções avançadas: registrar etapa à mão</summary>
            <p className="ajuda">
              Use só se não quiser usar a extensão. Informe o nome exato da empresa e do cargo cadastrados.
            </p>
            <form onSubmit={enviar} className="formulario-progresso">
              <label>
                Empresa
                <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} required />
              </label>
              <label>
                Cargo
                <input value={cargo} onChange={(e) => setCargo(e.target.value)} required />
              </label>
              <label>
                Etapas concluídas
                <input type="number" min={0} value={atual} onChange={(e) => setAtual(e.target.value)} required />
              </label>
              <label>
                Total de etapas
                <input type="number" min={1} value={total} onChange={(e) => setTotal(e.target.value)} required />
              </label>
              <button type="submit" disabled={registrar.isPending}>Salvar progresso</button>
            </form>
            {aviso && <p role="status" className="ajuda">{aviso}</p>}
          </details>
        </>
      )}
    </section>
  );
}
