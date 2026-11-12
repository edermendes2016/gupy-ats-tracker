// Painel de acompanhamento: indicadores, funil, faixas de score, evolução mensal e termos.
// Só usa dados agregados. O botão de compartilhar aparece só no modo anônimo.
import { useEffect, useState } from "react";
import { useMetricas } from "../../aplicacao/consultas";
import { ROTULO_STATUS, STATUS, type Metricas, type Termo } from "../../dominio/tipos";
import {
  ASSUNTO_CARTAO,
  CHAMADA_CARTAO,
  REPOSITORIO_URL,
  linksCompartilhamento,
  montarCartao,
  textoCartao,
  urlPublica,
} from "../../dominio/cartao";
import { gerarPng } from "../cartao/png";

const pct = (parte: number, todo: number) => (todo ? Math.round((100 * parte) / todo) : 0);

function Barras({ itens, rotulo, vazio }: { itens: Array<{ nome: string; valor: number }>; rotulo: string; vazio: string }) {
  if (!itens.length) return <p className="ajuda">{vazio}</p>;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <ul className="barras" aria-label={rotulo}>
      {itens.map((i) => (
        <li key={i.nome}>
          <span className="barra-rotulo">{i.nome}</span>
          <span className="barra-trilho">
            <span className="barra-valor" style={{ width: `${(100 * i.valor) / max}%` }} />
          </span>
          <span className="barra-numero">{i.valor}</span>
        </li>
      ))}
    </ul>
  );
}

function Funil({ m }: { m: Metricas }) {
  const contagem = new Map(m.porStatus.map((s) => [s.status, s.vagas]));
  const itens = STATUS.map((s) => ({ nome: ROTULO_STATUS[s], valor: contagem.get(s) ?? 0 })).filter((i) => i.valor > 0);
  return (
    <section aria-label="Funil por status">
      <h3>Funil por status</h3>
      <Barras itens={itens} rotulo="Vagas por status" vazio="Nenhuma vaga registrada ainda." />
    </section>
  );
}

function Faixas({ m }: { m: Metricas }) {
  return (
    <section aria-label="Conversão por faixa de score">
      <h3>Conversão por faixa de Match Score</h3>
      <table className="tabela-simples">
        <thead>
          <tr><th>Faixa</th><th>Candidaturas</th><th>Entrevistas</th><th>Conversão</th></tr>
        </thead>
        <tbody>
          {m.faixas.map((f) => (
            <tr key={f.faixa}>
              <td>{f.faixa}%</td>
              <td>{f.enviadas}</td>
              <td>{f.entrevistas}</td>
              <td>{pct(f.entrevistas, f.enviadas)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Evolucao({ m }: { m: Metricas }) {
  const max = Math.max(...m.evolucao.map((e) => e.enviadas), 1);
  if (!m.evolucao.length) return <p className="ajuda">Sem histórico ainda.</p>;
  return (
    <section aria-label="Evolução mensal">
      <h3>Evolução mensal</h3>
      <div className="colunas" role="img" aria-label="Candidaturas enviadas por mês">
        {m.evolucao.map((e) => (
          <div key={e.mes} className="coluna">
            <span className="coluna-valor">{e.enviadas}</span>
            <span className="coluna-barra" style={{ height: `${(100 * e.enviadas) / max}%` }} />
            <span className="coluna-mes">{e.mes.slice(5)}/{e.mes.slice(2, 4)}</span>
          </div>
        ))}
      </div>
      <details>
        <summary>Ver como tabela</summary>
        <table className="tabela-simples">
          <thead>
            <tr><th>Mês</th><th>Analisadas</th><th>Candidaturas</th><th>Entrevistas</th></tr>
          </thead>
          <tbody>
            {m.evolucao.map((e) => (
              <tr key={e.mes}>
                <td>{e.mes}</td><td>{e.analisadas}</td><td>{e.enviadas}</td><td>{e.entrevistas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

const paraItens = (t: Termo[]) => t.map((x) => ({ nome: x.nome, valor: x.vagas }));

function CompartilharCartao({ m, anonimo }: { m: Metricas; anonimo: boolean }) {
  const [png, setPng] = useState<{ url: string; blob: Blob } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const cartao = montarCartao(m);
  const texto = textoCartao(cartao);
  const chave = JSON.stringify(cartao);
  const podeNativo = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // A prévia é redesenhada sempre que os números mudam. Libera a URL anterior ao trocar.
  useEffect(() => {
    if (!anonimo) return;
    let cancelado = false;
    let url: string | null = null;
    gerarPng(cartao)
      .then((blob) => {
        if (cancelado) return;
        url = URL.createObjectURL(blob);
        setPng({ url, blob });
      })
      .catch(() => {
        if (!cancelado) setAviso("Prévia indisponível neste navegador. Use o texto abaixo.");
      });
    return () => {
      cancelado = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [chave, anonimo]);

  async function obterPng(): Promise<Blob> {
    if (png) return png.blob;
    return gerarPng(cartao);
  }

  async function copiar(mensagem = "Texto copiado.") {
    try {
      await navigator.clipboard.writeText(texto);
      setAviso(mensagem);
    } catch {
      setAviso("Não consegui copiar. Selecione o texto abaixo e copie manualmente.");
    }
  }

  // Folha de compartilhamento do sistema. Envia o PNG junto quando o aparelho aceita arquivos.
  async function compartilharNativo() {
    setAviso(null);
    try {
      const url = urlPublica(window.location);
      const dados: ShareData = { title: ASSUNTO_CARTAO, text: texto, ...(url ? { url } : {}) };
      const blob = await obterPng();
      const arquivo = new File([blob], "gupy-tracker-metricas.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ ...dados, files: [arquivo] });
      } else {
        await navigator.share(dados);
      }
    } catch (erro) {
      if ((erro as Error).name !== "AbortError") setAviso("Não consegui abrir o compartilhamento. Use os links abaixo.");
    }
  }

  if (!anonimo) {
    return (
      <section className="compartilhar" aria-label="Compartilhar">
        <h3>Compartilhar</h3>
        <div className="barra">
          <button disabled>Compartilhar</button>
          <button disabled>Copiar texto</button>
        </div>
        <p className="ajuda">Ative o Modo anônimo (no topo da página) para compartilhar.</p>
      </section>
    );
  }

  const url = urlPublica(window.location);
  const links = linksCompartilhamento(texto, url);

  return (
    <section className="compartilhar" aria-label="Compartilhar">
      <h3>Compartilhar</h3>
      <p className="ajuda">Só aparecem totais e termos do perfil. Nada de empresas, vagas ou links de vagas.</p>
      {png && <img src={png.url} alt="Prévia do cartão com as métricas anônimas" className="previa-cartao" width={1200} height={627} />}
      <div className="barra">
        <a className="botao botao-principal" href={REPOSITORIO_URL} target="_blank" rel="noopener noreferrer">
          {CHAMADA_CARTAO}
        </a>
        {podeNativo && <button onClick={compartilharNativo}>Compartilhar</button>}
        <button onClick={() => copiar()}>Copiar texto</button>
        {png && <a className="botao" href={png.url} download="gupy-tracker-metricas.png">Baixar imagem</a>}
      </div>
      <ul className="redes" aria-label="Compartilhar em redes sociais">
        {links.map((l) => (
          <li key={l.id}>
            <a
              className="botao"
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={l.copiarAoClicar ? () => copiar("Texto copiado. Cole no post do LinkedIn.") : undefined}
            >
              {l.nome}
            </a>
          </li>
        ))}
      </ul>
      <p className="ajuda">No LinkedIn o texto não vai pré-preenchido: ao clicar, ele é copiado. Cole na publicação e, se quiser, anexe a imagem (Baixar imagem).</p>
      {aviso && <p role="status" className="ajuda">{aviso}</p>}
      <pre className="texto-cartao">{texto}</pre>
    </section>
  );
}

export function MetricasPainel({ anonimo = false }: { anonimo?: boolean }) {
  const consulta = useMetricas();
  if (consulta.isPending) return <p>Carregando…</p>;
  if (consulta.isError) return <p role="alert" className="erro">{consulta.error.message}</p>;
  const m = consulta.data;
  return (
    <div className="painel">
      <section className="cartoes" aria-label="Indicadores">
        <div className="cartao"><span className="num">{m.total}</span><span>vagas analisadas</span></div>
        <div className="cartao"><span className="num">{m.enviadas}</span><span>candidaturas</span></div>
        <div className="cartao"><span className="num">{m.chegaramEntrevista}</span><span>chegaram à entrevista</span></div>
        <div className="cartao"><span className="num">{Math.round(m.taxaConversao * 100)}%</span><span>conversão em entrevista</span></div>
        <div className="cartao"><span className="num">{m.ofertas}</span><span>ofertas</span></div>
        <div className="cartao"><span className="num">{m.scoreMedio}%</span><span>score médio</span></div>
      </section>

      <div className="grade-painel">
        <Funil m={m} />
        <Evolucao m={m} />
        <Faixas m={m} />
        <section aria-label="Pontos fortes">
          <h3>Pontos fortes</h3>
          <p className="ajuda">Palavras-chave do currículo que aparecem nas vagas.</p>
          <Barras itens={paraItens(m.pontosFortes)} rotulo="Pontos fortes" vazio="Ainda sem termos em comum." />
        </section>
        <section aria-label="Lacunas">
          <h3>Lacunas para estudar</h3>
          <p className="ajuda">Termos pedidos nas vagas que faltam no currículo.</p>
          <Barras itens={paraItens(m.lacunas)} rotulo="Lacunas" vazio="Nenhuma lacuna registrada." />
        </section>
      </div>

      <CompartilharCartao m={m} anonimo={anonimo} />
    </div>
  );
}
