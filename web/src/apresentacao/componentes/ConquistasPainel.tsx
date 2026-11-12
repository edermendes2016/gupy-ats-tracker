// Aba Conquistas: títulos cômicos calculados no BFF a partir das vagas. Cada um tem frase de motivação.
// No modo anônimo, os textos não citam empresa; o detalhe de silêncio mostra só os dias.
import { useConquistas } from "../../aplicacao/consultas";

export function ConquistasPainel({ anonimo }: { anonimo: boolean }) {
  const conquistas = useConquistas(anonimo);

  if (conquistas.isPending) return <p>Carregando conquistas…</p>;
  if (conquistas.isError) return <p role="alert" className="erro">{conquistas.error.message}</p>;
  const lista = conquistas.data;
  const desbloqueadas = lista.filter((c) => c.desbloqueada).length;

  return (
    <section aria-label="Conquistas" className="conquistas">
      <p className="ajuda">
        Conquistas saem sozinhas das suas vagas e do tempo que elas levam. Os títulos são de brincadeira;
        a motivação, não.
      </p>
      <p className="conquistas-contagem">
        <strong>{desbloqueadas}</strong> de {lista.length} desbloqueadas
      </p>
      <ul className="conquistas-grade">
        {lista.map((c) => (
          <li key={c.id} className={c.desbloqueada ? "conquista desbloqueada" : "conquista bloqueada"}>
            <div className="conquista-cabeca">
              <h4>{c.titulo}</h4>
              {!c.desbloqueada && <span className="cadeado" aria-hidden="true">🔒</span>}
              <span className="conquista-selo">{c.desbloqueada ? "Desbloqueada" : "Bloqueada"}</span>
            </div>
            {c.detalhe && <p className="conquista-detalhe">{c.detalhe}</p>}
            <p className="conquista-requisito">Como ganhar: {c.requisito}</p>
            <p className="conquista-motivacao">“{c.motivacao}”</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
