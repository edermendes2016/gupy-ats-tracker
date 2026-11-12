// Desenha o cartão num canvas e devolve um PNG. Usa só a API do navegador.
import type { Cartao } from "../../dominio/cartao";

const LARGURA = 1080;
const ALTURA = 1080;
const CORES = {
  fundo: "#fcfcfb",
  texto: "#0b0b0b",
  secundario: "#52514e",
  barra: "#2a78d6",
  trilho: "#e6e5e1",
};

export function desenharCartao(ctx: CanvasRenderingContext2D, c: Cartao): void {
  ctx.fillStyle = CORES.fundo;
  ctx.fillRect(0, 0, LARGURA, ALTURA);
  ctx.fillStyle = CORES.texto;
  ctx.font = "bold 56px system-ui, sans-serif";
  ctx.fillText(c.titulo, 72, 120);

  ctx.font = "44px system-ui, sans-serif";
  c.indicadores.forEach((i, n) => {
    const y = 220 + n * 90;
    ctx.fillStyle = CORES.texto;
    ctx.font = "bold 44px system-ui, sans-serif";
    ctx.fillText(i.valor, 72, y);
    ctx.fillStyle = CORES.secundario;
    ctx.font = "36px system-ui, sans-serif";
    ctx.fillText(i.rotulo, 260, y);
  });

  const bloco = (titulo: string, itens: string[], y: number, cor: string) => {
    ctx.fillStyle = cor;
    ctx.font = "bold 40px system-ui, sans-serif";
    ctx.fillText(titulo, 72, y);
    ctx.fillStyle = CORES.texto;
    ctx.font = "34px system-ui, sans-serif";
    ctx.fillText(itens.join("  ·  ") || "—", 72, y + 56);
  };
  bloco("Pontos fortes", c.pontosFortes, 730, CORES.barra);
  bloco("Para estudar", c.lacunas, 890, CORES.secundario);

  ctx.fillStyle = CORES.secundario;
  ctx.font = "28px system-ui, sans-serif";
  ctx.fillText(c.rodape, 72, ALTURA - 60);
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
