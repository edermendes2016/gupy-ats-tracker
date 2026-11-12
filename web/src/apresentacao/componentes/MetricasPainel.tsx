import { useMetricas } from "../../aplicacao/consultas";

export function MetricasPainel() {
  const consulta = useMetricas();
  if (consulta.isPending) return <p>Carregando…</p>;
  if (consulta.isError) return <p role="alert" className="erro">{consulta.error.message}</p>;
  const m = consulta.data;
  const percentual = Math.round(m.taxaConversao * 100);
  return (
    <section className="cartoes" aria-label="Métricas do funil">
      <div className="cartao"><span className="num">{m.total}</span><span>vagas analisadas</span></div>
      <div className="cartao"><span className="num">{m.enviadas}</span><span>candidaturas</span></div>
      <div className="cartao"><span className="num">{m.chegaramEntrevista}</span><span>chegaram à entrevista</span></div>
      <div className="cartao"><span className="num">{percentual}%</span><span>conversão em entrevista</span></div>
    </section>
  );
}
