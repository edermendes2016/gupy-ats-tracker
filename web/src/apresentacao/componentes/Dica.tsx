import { useState, type FocusEvent, type KeyboardEvent } from "react";

/**
 * Botão "?" ao lado de um rótulo. Abre e fecha a explicação por clique ou teclado
 * (Enter/Espaço no botão; Esc fecha). A explicação fica fora do fluxo do formulário,
 * então os campos continuam alinhados.
 */
export function Dica({ id, rotulo, texto }: { id: string; rotulo: string; texto: string }) {
  const [aberta, setAberta] = useState(false);

  function teclar(e: KeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Escape") setAberta(false);
  }

  function sairDoFoco(e: FocusEvent<HTMLSpanElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setAberta(false);
  }

  return (
    <span className="dica" onKeyDown={teclar} onBlur={sairDoFoco}>
      <button
        type="button"
        className="dica-botao"
        aria-label={`Ajuda: ${rotulo}`}
        aria-expanded={aberta}
        aria-controls={id}
        onClick={() => setAberta((v) => !v)}
      >
        ?
      </button>
      <span id={id} role="note" className="dica-texto" hidden={!aberta}>
        {texto}
      </span>
    </span>
  );
}
