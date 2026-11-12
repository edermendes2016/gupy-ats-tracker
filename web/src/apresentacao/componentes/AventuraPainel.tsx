// Aba Aventura: o personagem sobe de nível sozinho, a partir das vagas cadastradas.
// O XP vem do status e das datas da aba Vagas. Não há formulário de etapa: o que
// o personagem precisa já está no cadastro da vaga.
// No modo anônimo, a lista por vaga não aparece e o XP de cada gerador fica oculto,
// porque as datas de cada etapa não saem da máquina nesse modo.
import { useAventura, useMetricas, useMissoes, useVagas } from "../../aplicacao/consultas";
import { ROTULO_STATUS, type Vaga } from "../../dominio/tipos";
import {
  diarioDeBordo, geradoresDeXp, missoesFeitas, taxaPassiva, temBuffMatch, vagasNoFunil, xpDiaDaVaga,
} from "../../dominio/aventuraRpg";
import { corDoSelo } from "../../dominio/score";
import { MissoesPainel } from "./MissoesPainel";

const pct = (parte: number, todo: number) => (todo > 0 ? Math.min(100, Math.round((100 * parte) / todo)) : 0);

function Atributo({ sigla, valor, legenda }: { sigla: string; valor: number; legenda: string }) {
  return (
    <li className="atributo">
      <span className="atributo-sigla">{sigla}</span>
      <strong className="atributo-valor">{valor}</strong>
      <span className="ajuda">{legenda}</span>
    </li>
  );
}

function Gerador({ vaga, xp, anonimo }: { vaga: Vaga; xp: number | undefined; anonimo: boolean }) {
  const buff = temBuffMatch(vaga);
  return (
    <li className={`gerador${buff ? " gerador-buff" : ""}`}>
      <div className="gerador-cabeca">
        <span className="gerador-pulso" aria-hidden="true" title="Farmando XP" />
        <div className="gerador-texto">
          <span className="gerador-empresa">{vaga.empresa}</span>
          <span className="ajuda">{vaga.cargo}</span>
        </div>
      </div>
      <div className="gerador-meta">
        <span className={`selo-badge selo-${corDoSelo(vaga.matchScore)}`}>{vaga.matchScore}%</span>
        <span className={`status-badge s-${vaga.status}`}><span className="status-dot" aria-hidden="true" />{ROTULO_STATUS[vaga.status]}</span>
      </div>
      {buff && <span className="buff-match">⚡ Buff de Match Alto</span>}
      <span className="gerador-xp">
        {anonimo ? (
          <span className="ajuda">XP oculto no modo anônimo</span>
        ) : xp === undefined ? (
          <span className="ajuda">Calculando XP…</span>
        ) : (
          <>
            <strong>{xp}</strong> XP · +{xpDiaDaVaga(vaga)}/dia
          </>
        )}
      </span>
    </li>
  );
}

export function AventuraPainel({ anonimo }: { anonimo: boolean }) {
  const aventura = useAventura(anonimo);
  const vagas = useVagas({ anonimo });
  const metricas = useMetricas();
  const missoes = useMissoes();

  if (aventura.isPending) return <p>Carregando…</p>;
  if (aventura.isError) return <p role="alert" className="erro">{aventura.error.message}</p>;
  const a = aventura.data;

  const andamento = pct(a.xp - a.xpNivelAtual, a.xpProximoNivel - a.xpNivelAtual);
  const maiorXp = Math.max(1, ...a.vagas.map((v) => v.xp));
  const listaVagas: Vaga[] = Array.isArray(vagas.data) ? vagas.data : [];
  const xpPorId = new Map(a.vagas.map((v) => [v.id, v.xp]));
  const geradores = geradoresDeXp(listaVagas);
  const listaMissoes = missoes.data?.missoes ?? [];
  const forca = metricas.data?.pontosFortes?.length ?? 0;

  return (
    <section aria-label="Aventura" className="aventura">
      <div className="aventura-heroi">
        <div className="aventura-cabeca">
          <span className="aventura-selo" aria-hidden="true">{a.nivel}</span>
          <div className="aventura-cabeca-texto">
            <p className="aventura-rotulo">Nível {a.nivel}</p>
            <p className="aventura-titulo">{a.titulo}</p>
          </div>
          <span className="farm-passivo" title="XP por dia das vagas que esperam resposta">
            <span className="status-dot pulsante" aria-hidden="true" />
            Farm passivo +{taxaPassiva(listaVagas)} XP/dia
          </span>
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
        <ul className="atributos" aria-label="Atributos">
          <Atributo sigla="ATK" valor={forca} legenda="Pontos fortes" />
          <Atributo sigla="DEF" valor={vagasNoFunil(listaVagas)} legenda="Resiliência no funil" />
          <Atributo sigla="FOCO" valor={missoesFeitas(listaMissoes)} legenda={`Missões de hoje (de ${listaMissoes.length})`} />
        </ul>
      </div>

      <p className="ajuda">
        Seu personagem sobe de nível enquanto as vagas esperam resposta. O XP vem do status e das datas
        da aba Vagas: quanto mais tempo numa etapa que rende, mais XP. Não há ranking.
      </p>

      <h3>Geradores de XP ativos</h3>
      {geradores.length === 0 ? (
        <p className="ajuda">Nenhuma vaga esperando resposta. Cadastre vagas para os geradores começarem a farmar.</p>
      ) : (
        <ul className="geradores">
          {geradores.map((v) => (
            <Gerador key={v.id} vaga={v} xp={anonimo ? undefined : xpPorId.get(v.id)} anonimo={anonimo} />
          ))}
        </ul>
      )}

      <section aria-label="Diário de bordo" className="diario">
        <h3>Diário de bordo</h3>
        <ul className="diario-log" role="log" aria-live="polite">
          {diarioDeBordo(listaVagas, listaMissoes, a.nivel, a.titulo).map((l) => (
            <li key={l.id} className={`diario-linha diario-${l.tom}`}>{l.texto}</li>
          ))}
        </ul>
      </section>

      <MissoesPainel />

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
