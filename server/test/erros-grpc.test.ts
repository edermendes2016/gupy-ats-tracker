import { describe, expect, it } from "vitest";
import * as grpc from "@grpc/grpc-js";
import { traduzirErro } from "../src/infraestrutura/grpc/clientes.js";
import { ErroIndisponivel } from "../src/aplicacao/erros.js";

describe("traduzirErro", () => {
  it("UNIMPLEMENTED vira erro de serviço indisponível com a orientação de atualização", () => {
    const erro = traduzirErro({ code: grpc.status.UNIMPLEMENTED, details: "Method not found!", message: "" } as grpc.ServiceError);
    expect(erro).toBeInstanceOf(ErroIndisponivel);
    expect(erro.message).toContain("gerar_proto");
    expect(erro.message).toContain("Method not found!");
  });
});
