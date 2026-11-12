import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { registrarEstaticos } from "../src/apresentacao/http/estaticos.js";

function preparar() {
  const dir = mkdtempSync(join(tmpdir(), "ui-"));
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><title>ui</title>");
  writeFileSync(join(dir, "assets", "app.js"), "console.log(1)");
  const app = Fastify();
  app.get("/api/saude", async () => ({ ok: true }));
  registrarEstaticos(app, dir);
  return app;
}

describe("interface estática", () => {
  it("serve arquivos e cai no index.html para rotas da SPA", async () => {
    const app = preparar();
    const js = await app.inject({ method: "GET", url: "/assets/app.js" });
    expect(js.headers["content-type"]).toContain("javascript");
    const rota = await app.inject({ method: "GET", url: "/alguma/rota" });
    expect(rota.body).toContain("<title>ui</title>");
  });

  it("não deixa a API cair na interface e não sai da pasta", async () => {
    const app = preparar();
    expect((await app.inject({ method: "GET", url: "/api/saude" })).json()).toEqual({ ok: true });
    expect((await app.inject({ method: "GET", url: "/api/inexistente" })).statusCode).toBe(404);
    const fuga = await app.inject({ method: "GET", url: "/..%2F..%2Fetc%2Fpasswd" });
    expect(fuga.body).not.toContain("root:");
  });
});
