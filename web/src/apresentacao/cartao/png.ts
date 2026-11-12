// Desenha o cartão num canvas e devolve um PNG. Usa só a API do navegador.
// Proporção 1200×627: a mesma das prévias de link do LinkedIn e de redes sociais.
import type { Barra, Cartao } from "../../dominio/cartao";

export const LARGURA = 1200;
export const ALTURA = 627;
const MARGEM = 56;
const FONTE = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
const CORES = {
  fundoTopo: "#0b1220",
  fundoBase: "#1a2a4a",
  tile: "rgba(255,255,255,0.06)",
  tileBorda: "rgba(255,255,255,0.14)",
  texto: "#f8fafc",
  suave: "#94a3b8",
  trilho: "rgba(255,255,255,0.10)",
  funil: "#34d399",
  fortes: "#60a5fa",
  estudar: "#fbbf24",
  destaque: "#2a78d6",
};

function retangulo(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Corta o texto com reticências até caber na largura. */
function caber(ctx: CanvasRenderingContext2D, texto: string, largura: number): string {
  if (ctx.measureText(texto).width <= largura) return texto;
  let corte = texto;
  while (corte.length > 1 && ctx.measureText(`${corte}…`).width > largura) corte = corte.slice(0, -1);
  return `${corte.trimEnd()}…`;
}

function fonte(ctx: CanvasRenderingContext2D, peso: string, tamanho: number): void {
  ctx.font = `${peso} ${tamanho}px ${FONTE}`;
}

function kpis(ctx: CanvasRenderingContext2D, c: Cartao, y: number): void {
  const gap = 16;
  const w = (LARGURA - 2 * MARGEM - gap * (c.indicadores.length - 1)) / c.indicadores.length;
  const h = 124;
  c.indicadores.forEach((i, n) => {
    const x = MARGEM + n * (w + gap);
    retangulo(ctx, x, y, w, h, 14);
    ctx.fillStyle = CORES.tile;
    ctx.fill();
    ctx.strokeStyle = CORES.tileBorda;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = CORES.texto;
    fonte(ctx, "bold", 46);
    ctx.fillText(i.valor, x + 18, y + 58);
    ctx.fillStyle = CORES.suave;
    fonte(ctx, "normal", 16);
    // Rótulo em até duas linhas, para não cortar "conversão em entrevista".
    const palavras = i.rotulo.split(" ");
    const meio = Math.ceil(palavras.length / 2);
    const linhas = caber(ctx, i.rotulo, w - 36) === i.rotulo
      ? [i.rotulo]
      : [palavras.slice(0, meio).join(" "), palavras.slice(meio).join(" ")];
    linhas.forEach((l, k) => ctx.fillText(l, x + 18, y + 90 + k * 18));
  });
}

function barras(ctx: CanvasRenderingContext2D, titulo: string, subtitulo: string, x: number, y: number, largura: number, itens: Barra[], cor: string): void {
  ctx.fillStyle = CORES.texto;
  fonte(ctx, "bold", 24);
  ctx.fillText(titulo, x, y);
  ctx.fillStyle = CORES.suave;
  fonte(ctx, "normal", 16);
  ctx.fillText(caber(ctx, subtitulo, largura), x, y + 28);

  if (!itens.length) {
    ctx.fillText("—", x, y + 72);
    return;
  }
  const rotuloLargura = largura * 0.58;
  const numeroLargura = 36;
  const trilhoLargura = largura - rotuloLargura - numeroLargura;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  itens.forEach((item, n) => {
    const linha = y + 72 + n * 40;
    ctx.fillStyle = CORES.texto;
    fonte(ctx, "normal", 17);
    ctx.fillText(caber(ctx, item.nome, rotuloLargura - 12), x, linha + 6);

    const tx = x + rotuloLargura;
    retangulo(ctx, tx, linha - 6, trilhoLargura, 14, 7);
    ctx.fillStyle = CORES.trilho;
    ctx.fill();
    const preenchido = Math.max((trilhoLargura * item.valor) / max, 14);
    retangulo(ctx, tx, linha - 6, preenchido, 14, 7);
    ctx.fillStyle = cor;
    ctx.fill();

    ctx.fillStyle = CORES.texto;
    fonte(ctx, "bold", 18);
    ctx.textAlign = "right";
    ctx.fillText(String(item.valor), x + largura, linha + 6);
    ctx.textAlign = "left";
  });
}

export function desenharCartao(ctx: CanvasRenderingContext2D, c: Cartao): void {
  const fundo = ctx.createLinearGradient(0, 0, LARGURA, ALTURA);
  fundo.addColorStop(0, CORES.fundoTopo);
  fundo.addColorStop(1, CORES.fundoBase);
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // Cabeçalho: título à esquerda, chamada para começar à direita.
  ctx.fillStyle = CORES.texto;
  fonte(ctx, "bold", 40);
  ctx.fillText(c.titulo, MARGEM, 88);
  ctx.fillStyle = CORES.suave;
  fonte(ctx, "normal", 20);
  ctx.fillText("Acompanhamento de vagas na Gupy", MARGEM, 120);

  const botaoLargura = 230;
  const botaoX = LARGURA - MARGEM - botaoLargura;
  retangulo(ctx, botaoX, 50, botaoLargura, 56, 28);
  ctx.fillStyle = CORES.destaque;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  fonte(ctx, "bold", 22);
  ctx.textAlign = "center";
  ctx.fillText(`${c.chamada} →`, botaoX + botaoLargura / 2, 86);
  ctx.textAlign = "left";

  kpis(ctx, c, 150);

  const topo = 310;
  const colunas = {
    funil: { x: MARGEM, w: 300 },
    fortes: { x: 390, w: 360 },
    estudar: { x: 784, w: LARGURA - MARGEM - 784 },
  };
  barras(ctx, "Funil por status", "Vagas em cada etapa", colunas.funil.x, topo, colunas.funil.w, c.funil, CORES.funil);
  barras(ctx, "Pontos fortes", "Aparecem nas vagas", colunas.fortes.x, topo, colunas.fortes.w, c.pontosFortes, CORES.fortes);
  barras(ctx, "Para estudar", "Pedidos nas vagas, fora do CV", colunas.estudar.x, topo, colunas.estudar.w, c.lacunas, CORES.estudar);

  // Rodapé: endereço do repositório e nota de anonimato.
  ctx.strokeStyle = CORES.tileBorda;
  ctx.beginPath();
  ctx.moveTo(MARGEM, ALTURA - 62);
  ctx.lineTo(LARGURA - MARGEM, ALTURA - 62);
  ctx.stroke();
  ctx.fillStyle = CORES.fortes;
  fonte(ctx, "bold", 20);
  ctx.fillText(c.repositorio, MARGEM, ALTURA - 26);
  ctx.fillStyle = CORES.suave;
  fonte(ctx, "normal", 16);
  ctx.textAlign = "right";
  ctx.fillText(c.rodape, LARGURA - MARGEM, ALTURA - 26);
  ctx.textAlign = "left";
}

export function gerarPng(c: Cartao): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("canvas indisponível neste navegador"));
  desenharCartao(ctx, c);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("não foi possível gerar a imagem"))), "image/png"),
  );
}
