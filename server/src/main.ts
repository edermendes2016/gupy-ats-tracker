// Ponto de entrada do BFF. Configuração por variáveis de ambiente:
//   HOST (padrão 127.0.0.1), PORT (padrão 3000), GRPC_ENDERECO (padrão 127.0.0.1:50051)
import { criarCasosDeUso } from "./aplicacao/casos.js";
import { criarRepositoriosGrpc } from "./infraestrutura/grpc/clientes.js";
import { criarApp } from "./apresentacao/http/app.js";

const HOST = process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.PORT ?? 3000);
const GRPC_ENDERECO = process.env.GRPC_ENDERECO ?? "127.0.0.1:50051";

const repos = criarRepositoriosGrpc(GRPC_ENDERECO);
const casos = criarCasosDeUso({
  vagas: repos.vagas,
  ranking: repos.ranking,
  planilha: repos.planilha,
  analise: repos.analise,
});
const app = criarApp(casos, { logger: true });

app.listen({ host: HOST, port: PORT }).catch((erro) => {
  app.log.error(erro);
  repos.fechar();
  process.exit(1);
});
