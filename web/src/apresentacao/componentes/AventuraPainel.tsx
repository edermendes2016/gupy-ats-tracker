// Aba Aventura: o personagem sobe de nível sozinho, a partir das vagas cadastradas.
// O XP vem do status e das datas da aba Vagas. Não há formulário de etapa: o que
// o personagem precisa já está no cadastro da vaga.
// No modo anônimo, a lista por vaga não aparece.
import { useAventura } from "../../aplicacao/consultas";
import { MissoesPainel } from "./MissoesPainel";

const pct = (parte: number, todo: number) => (todo > 0 ? Math.min(100, Math.round((100 * parte) / todo)) : 0);

export function AventuraPainel({ anonimo }: { anonimo: boolean }) {
  const aventura = useAventura(anonimo);

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

      <MissoesPainel />

      <div className="aventura-cartao">
        <div className="aventura-cabeca">
          <span className="aventura-selo" aria-hidden="true">{a.nivel}</span>
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
          {a.bonus > 0 && <span className="ajuda"> (inclui {a.bonus} de conquistas e missões)</span>}
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
        </>
      )}
    </section>
  );
}
