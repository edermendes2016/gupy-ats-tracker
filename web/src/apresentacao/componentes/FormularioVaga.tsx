import { useState, type FormEvent } from "react";
import { Dica } from "./Dica";
import { useAnalisarCurriculo, useRegistrarVaga } from "../../aplicacao/consultas";
import {
  CRITERIOS, MODELOS, ROTULO_MODELO, ROTULO_SENIORIDADE, SENIORIDADES,
  type Criterios, type Modelo, type NomeCriterio, type NovaVaga, type ResultadoAnalise, type Senioridade,
} from "../../dominio/tipos";

const CRITERIOS_INICIAIS: Criterios = { obrigatorios: 0, desejaveis: 0, experiencia: 0, dominio: 0, logistica: 0 };

// Orientação para cada critério, para saber o que colocar (0 = nada, 100 = tudo).
const DICAS_CRITERIOS: Record<NomeCriterio, string> = {
  obrigatorios: "Quanto dos requisitos obrigatórios você cobre. 100 = tem todos; 50 = tem metade.",
  desejaveis: "Quanto dos diferenciais você cobre. Se a vaga não lista nenhum, use 50.",
  experiencia: "Tempo pedido x seu tempo na área. 100 = atende ou supera; abaixo disso, reduza na proporção.",
  dominio: "Afinidade com o setor e o tipo de problema (ex.: setor público, sistemas críticos). 100 = mesma área.",
  logistica: "Modelo (remoto, híbrido, presencial), local, idioma e salário. 100 = tudo compatível; 0 = incompatível.",
};
const EXTENSOES = ".pdf,.docx,.txt,.md";

/** Lê o arquivo como base64 (sem o prefixo data:). */
function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

export function FormularioVaga({ aoCriar }: { aoCriar: () => void }) {
  const registrar = useRegistrarVaga();
  const analisar = useAnalisarCurriculo();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [resultado, setResultado] = useState<ResultadoAnalise | null>(null);
  const [empresa, setEmpresa] = useState("");
  const [cargo, setCargo] = useState("");
  const [senioridade, setSenioridade] = useState<Senioridade>("nao_informada");
  const [modelo, setModelo] = useState<Modelo | "">("");
  const [url, setUrl] = useState("");
  const [criterios, setCriterios] = useState<Criterios>(CRITERIOS_INICIAIS);
  const [palavras, setPalavras] = useState("");
  const [lacunas, setLacunas] = useState("");
  const [descricao, setDescricao] = useState("");

  const lista = (texto: string) => texto.split(",").map((s) => s.trim()).filter(Boolean);

  async function analisarVaga() {
    if (!arquivo) return;
    const arquivoBase64 = await arquivoParaBase64(arquivo);
    analisar.mutate(
      {
        nomeArquivo: arquivo.name,
        arquivoBase64,
        descricao: descricao || undefined,
        modelo: modelo || undefined,
      },
      {
        onSuccess: (r) => {
          setResultado(r);
          setCriterios(r.criterios);
          setPalavras(r.palavrasChave.join(", "));
          setLacunas(r.lacunas.join(", "));
          // O link da vaga vem do próprio texto colado, se ele trouxer um; senão, fica como digitado.
          const link = descricao.match(/https?:\/\/[^\s)<>"]+/);
          if (link && !url) setUrl(link[0]);
        },
      },
    );
  }

  function enviar(e: FormEvent) {
    e.preventDefault();
    const nova: NovaVaga = {
      empresa, cargo, senioridade,
      area: "outra",
      modelo: modelo || null,
      url: url || undefined,
      status: "analisada",
      criterios,
      palavrasChave: lista(palavras),
      lacunas: lista(lacunas),
      descricao: descricao || undefined,
    };
    registrar.mutate(nova, { onSuccess: () => aoCriar() });
  }

  return (
    <form className="formulario" onSubmit={enviar} noValidate>
      <fieldset>
        <legend>Análise automática</legend>
        <div className="campos">
          <label className="largo">Currículo (PDF com texto, DOCX, TXT ou MD)
            <input type="file" accept={EXTENSOES} onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
          </label>
          <label className="largo">Texto da vaga (cole a página da Gupy: descrição, responsabilidades e requisitos)
            <textarea rows={6} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </label>
        </div>
        <button type="button" onClick={analisarVaga} disabled={!arquivo || !descricao.trim() || analisar.isPending}>
          {analisar.isPending ? "Analisando…" : "Analisar currículo"}
        </button>
        {analisar.isError && <p role="alert" className="erro">{analisar.error.message}</p>}
        {resultado && (
          <div className="resultado-analise">
            <p><strong>Match Score {resultado.matchScore}%</strong> ({resultado.classificacao}). Os campos abaixo foram preenchidos e podem ser ajustados.</p>
            {resultado.lacunas.length > 0 && <p><strong>Gap para estudar:</strong> {resultado.lacunas.join(", ")}</p>}
            {resultado.sugestoes.length > 0 && (
              <>
                <p><strong>Sugestões para o currículo:</strong></p>
                <ul>{resultado.sugestoes.map((s) => <li key={s}>{s}</li>)}</ul>
              </>
            )}
            {resultado.avisos.length > 0 && (
              <ul className="avisos">{resultado.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
            )}
          </div>
        )}
      </fieldset>

      <div className="campos">
        <label>Empresa<input required value={empresa} onChange={(e) => setEmpresa(e.target.value)} /></label>
        <label>Cargo<input required value={cargo} onChange={(e) => setCargo(e.target.value)} /></label>
        <label>Senioridade
          <select value={senioridade} onChange={(e) => setSenioridade(e.target.value as Senioridade)}>
            {SENIORIDADES.map((s) => <option key={s} value={s}>{ROTULO_SENIORIDADE[s]}</option>)}
          </select>
        </label>
        <label>Modelo
          <select value={modelo} onChange={(e) => setModelo(e.target.value as Modelo | "")}>
            <option value="">Não informado</option>
            {MODELOS.map((m) => <option key={m} value={m}>{ROTULO_MODELO[m]}</option>)}
          </select>
        </label>
        <label className="largo">Link da vaga<input type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
      </div>

      <fieldset>
        <legend>Critérios (0 a 100)</legend>
        {CRITERIOS.map((c) => (
          <div className="criterio" key={c.nome}>
            <span className="criterio-rotulo">
              <label htmlFor={`criterio-${c.nome}`}>{c.rotulo} <small>({c.peso}%)</small></label>
              <Dica id={`dica-${c.nome}`} rotulo={c.rotulo} texto={DICAS_CRITERIOS[c.nome]} />
            </span>
            <input
              id={`criterio-${c.nome}`}
              type="number" min={0} max={100} step={1} required aria-describedby={`dica-${c.nome}`}
              value={criterios[c.nome]}
              onChange={(e) => setCriterios({ ...criterios, [c.nome]: Number(e.target.value) })}
            />
          </div>
        ))}
      </fieldset>

      <div className="campos">
        <label className="largo">Palavras-chave (separadas por vírgula)
          <input value={palavras} onChange={(e) => setPalavras(e.target.value)} />
        </label>
        <label className="largo">Lacunas (separadas por vírgula)
          <input value={lacunas} onChange={(e) => setLacunas(e.target.value)} />
        </label>
      </div>

      {registrar.isError && <p role="alert" className="erro">{registrar.error.message}</p>}
      <button type="submit" disabled={registrar.isPending}>
        {registrar.isPending ? "Salvando…" : "Salvar vaga"}
      </button>
    </form>
  );
}
