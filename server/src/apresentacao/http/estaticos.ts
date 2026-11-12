// Serve a interface já compilada (web/dist) pelo próprio BFF. Usado na imagem Docker,
// para que um único processo HTTP entregue a UI e a API. Sem a opção, nada é servido.
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import type { FastifyInstance } from "fastify";

const TIPOS: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

export function registrarEstaticos(app: FastifyInstance, diretorio: string): void {
  const raiz = resolve(diretorio);
  const indice = join(raiz, "index.html");
  if (!existsSync(indice)) throw new Error(`interface não encontrada em ${raiz} (rode 'npm run build' em web/)`);

  app.get("/*", async (req, resposta) => {
    if (req.url.startsWith("/api/")) return resposta.status(404).send({ erro: "rota não encontrada" });
    const relativo = decodeURIComponent(req.url.split("?")[0]!.replace(/^\/+/, ""));
    const arquivo = resolve(raiz, normalize(relativo));
    // Nunca sai da pasta da interface (sem ../ escapando).
    const dentro = arquivo === raiz || arquivo.startsWith(raiz + sep);
    const escolhido = dentro && relativo && existsSync(arquivo) && statSync(arquivo).isFile() ? arquivo : indice;
    resposta.type(TIPOS[extname(escolhido)] ?? "application/octet-stream");
    return resposta.send(readFileSync(escolhido));
  });
}
