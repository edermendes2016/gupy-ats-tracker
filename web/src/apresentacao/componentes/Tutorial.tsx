import { useEffect, useRef } from "react";

export type AbaTutorial = "ranking" | "vagas" | "nova";

export interface PassoTutorial {
  titulo: string;
  texto: string;
  /** Aba que o passo mostra ao fundo, para o usuário ver do que se trata. */
  aba: AbaTutorial;
}

export const PASSOS_TUTORIAL: PassoTutorial[] = [
  {
    titulo: "Bem-vindo! Vamos fazer seu primeiro cadastro",
    texto:
      "Em 4 passos rápidos você registra uma vaga e vê o resultado. Você não precisa decorar nada: dá para pular agora e rever depois pelo botão “Tutorial”.",
    aba: "nova",
  },
  {
    titulo: "1. Envie seu currículo",
    texto:
      "Em Nova vaga, escolha o currículo (PDF com texto, DOCX, TXT ou MD) e cole o texto da vaga copiado da Gupy. Clique em Analisar currículo e os campos são preenchidos para você.",
    aba: "nova",
  },
  {
    titulo: "2. Cadastre a vaga",
    texto:
      "Confira empresa, cargo, senioridade e modelo, ajuste o que quiser e salve em Registrar vaga. Se preferir, preencha tudo à mão, sem enviar currículo.",
    aba: "nova",
  },
  {
    titulo: "3. Entenda o score e os critérios",
    texto:
      "O Match Score de 0 a 100% soma 5 critérios, cada um de 0 a 100: requisitos obrigatórios (50%), desejáveis (15%), experiência (15%), domínio (10%) e logística (10%). Use o botão ? ao lado de cada critério para saber o que colocar.",
    aba: "nova",
  },
  {
    titulo: "4. Veja o resultado",
    texto:
      "O Ranking ordena as vagas do melhor score para o menor, e Vagas permite filtrar por status e acompanhar cada candidatura. Ative o Modo anônimo para compartilhar prints sem expor empresas.",
    aba: "ranking",
  },
];

/**
 * Tour guiado de primeiro uso: cartão fixo no canto da tela (não bloqueia a interface).
 * O componente é controlado: quem o usa decide quando abrir, em que passo está e o que
 * acontece ao pular ou concluir.
 */
export function Tutorial({
  passo, aoMudarPasso, aoFechar,
}: {
  passo: number;
  aoMudarPasso: (passo: number) => void;
  /** Chamado ao pular ou concluir. */
  aoFechar: () => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const total = PASSOS_TUTORIAL.length;
  const atual = PASSOS_TUTORIAL[Math.min(Math.max(passo, 0), total - 1)]!;
  const ultimo = passo >= total - 1;

  useEffect(() => {
    ref.current?.focus();
  }, [passo]);

  return (
    <aside
      ref={ref}
      tabIndex={-1}
      className="tutorial"
      role="dialog"
      aria-label="Tutorial de primeiro cadastro"
      onKeyDown={(e) => e.key === "Escape" && aoFechar()}
    >
      <p className="tutorial-passo">Passo {passo + 1} de {total}</p>
      <div
        className="tutorial-trilho"
        role="progressbar"
        aria-label="Progresso do tutorial"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={passo + 1}
      >
        <span style={{ width: `${((passo + 1) / total) * 100}%` }} />
      </div>
      <h2 className="tutorial-titulo">{atual.titulo}</h2>
      <p className="tutorial-texto">{atual.texto}</p>
      <div className="tutorial-acoes">
        <button type="button" className="tutorial-pular" onClick={aoFechar}>Pular</button>
        <span className="tutorial-espaco" />
        {passo > 0 && (
          <button type="button" className="tutorial-voltar" onClick={() => aoMudarPasso(passo - 1)}>Voltar</button>
        )}
        <button
          type="button"
          className="tutorial-proximo"
          onClick={() => (ultimo ? aoFechar() : aoMudarPasso(passo + 1))}
        >
          {ultimo ? "Concluir" : "Próximo"}
        </button>
      </div>
    </aside>
  );
}

const CHAVE = "gupy-tracker:tutorial-visto";

/** localStorage pode estar bloqueado (aba privada, política do navegador): nunca deve quebrar o app. */
export function tutorialJaVisto(): boolean {
  try {
    return window.localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

export function marcarTutorialVisto(): void {
  try {
    window.localStorage.setItem(CHAVE, "1");
  } catch {
    /* sem armazenamento: o tutorial pode aparecer de novo, sem prejuízo */
  }
}
