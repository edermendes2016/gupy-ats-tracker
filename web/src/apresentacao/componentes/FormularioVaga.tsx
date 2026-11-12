import { useState, type FormEvent } from "react";
import { useRegistrarVaga } from "../../aplicacao/consultas";
import {
  CRITERIOS, MODELOS, ROTULO_MODELO, ROTULO_SENIORIDADE, SENIORIDADES,
  type Criterios, type Modelo, type NovaVaga, type Senioridade,
} from "../../dominio/tipos";

const CRITERIOS_INICIAIS: Criterios = { obrigatorios: 0, desejaveis: 0, experiencia: 0, dominio: 0, logistica: 0 };

export function FormularioVaga({ aoCriar }: { aoCriar: () => void }) {
  const registrar = useRegistrarVaga();
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
          <label key={c.nome}>
            {c.rotulo} <small>({c.peso}%)</small>
            <input
              type="number" min={0} max={100} step={1} required
              value={criterios[c.nome]}
              onChange={(e) => setCriterios({ ...criterios, [c.nome]: Number(e.target.value) })}
            />
          </label>
        ))}
      </fieldset>

      <div className="campos">
        <label className="largo">Palavras-chave (separadas por vírgula)
          <input value={palavras} onChange={(e) => setPalavras(e.target.value)} />
        </label>
        <label className="largo">Lacunas (separadas por vírgula)
          <input value={lacunas} onChange={(e) => setLacunas(e.target.value)} />
        </label>
        <label className="largo">Descrição
          <textarea rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
      </div>

      {registrar.isError && <p role="alert" className="erro">{registrar.error.message}</p>}
      <button type="submit" disabled={registrar.isPending}>
        {registrar.isPending ? "Salvando…" : "Salvar vaga"}
      </button>
    </form>
  );
}
