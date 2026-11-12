// Aba Aventura: o personagem desempregado sobe de nível com o tempo em cada etapa
// e com as etapas concluídas. Só mostra XP; a lista por vaga some no modo anônimo.
import { useState, type FormEvent } from "react";
import { useAventura, useRegistrarProgresso } from "../../aplicacao/consultas";

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
  const faixa = a.xpProximoNivel - a.xpNivelAtual;
  const andamento = faixa ? Math.round((100 * (a.xp - a.xpNivelAtual)) / faixa) : 0;

  return (
    <section aria-label="Aventura">
      <p className="ajuda">
        Seu personagem sobe de nível enquanto espera cada etapa da Gupy. Quanto mais tempo numa etapa
        que rende XP, e quanto mais etapas concluídas, mais XP. Não há ranking.
      </p>

      <div className="aventura-personagem">
        <p className="aventura-nivel">Nível {a.nivel}</p>
        <p className="aventura-titulo">{a.titulo}</p>
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
        <p className="ajuda">{a.xp} XP (próximo nível em {a.xpProximoNivel} XP)</p>
      </div>

      {!anonimo && (
        <>
          <h3>XP por vaga</h3>
          {a.vagas.length === 0 ? (
            <p className="ajuda">Nenhuma vaga rendeu XP ainda.</p>
          ) : (
            <ul className="aventura-vagas">
              {a.vagas.map((v) => (
                <li key={v.id}>
                  <span>{v.empresa} · {v.cargo}</span> <strong>{v.xp} XP</strong>
                </li>
              ))}
            </ul>
          )}

          <h3>Registrar etapa à mão</h3>
          <p className="ajuda">Alternativa à extensão. Use o nome exato da empresa e do cargo cadastrados.</p>
          <form onSubmit={enviar} className="formulario-progresso">
            <label>Empresa<input value={empresa} onChange={(e) => setEmpresa(e.target.value)} required /></label>
            <label>Cargo<input value={cargo} onChange={(e) => setCargo(e.target.value)} required /></label>
            <label>Etapas concluídas<input type="number" min={0} value={atual} onChange={(e) => setAtual(e.target.value)} required /></label>
            <label>Total de etapas<input type="number" min={1} value={total} onChange={(e) => setTotal(e.target.value)} required /></label>
            <button type="submit" disabled={registrar.isPending}>Salvar progresso</button>
          </form>
          {aviso && <p role="status" className="ajuda">{aviso}</p>}
        </>
      )}
    </section>
  );
}
