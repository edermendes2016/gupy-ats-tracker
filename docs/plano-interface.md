# Plano: interface React com TypeScript e comunicação gRPC

> Status: **proposta para aprovação**. Nenhum código foi escrito ainda. Este documento descreve a arquitetura, o contrato e as etapas; a implementação começa só depois da aprovação.

## 1. Resposta curta

**Sim, é possível.** Mas há uma correção importante na premissa: **o navegador não fala gRPC nativo**. A API `fetch` não expõe os trailers HTTP/2 que o gRPC usa para devolver o status, então um React rodando no navegador não consegue chamar um serviço gRPC puro.

Por isso a arquitetura proposta usa gRPC em dois pontos, com protocolos diferentes em cada um:

| Trecho | Protocolo | Justificativa |
|--------|-----------|---------------|
| Navegador (React) → BFF TypeScript | HTTP/JSON (ou Connect/gRPC-Web, opcional) | O navegador só fala HTTP. JSON aqui é adequado: a UI faz poucas chamadas por tela. |
| BFF TypeScript → serviço Python do ATS | **gRPC com Protobuf (binário)** | Comunicação interna entre serviços, com contrato forte em `.proto` e HTTP/2. Esse é o uso que faz sentido para gRPC. |

**Uma ressalva honesta sobre desempenho.** O volume deste projeto é pequeno: dezenas ou centenas de vagas, em uma máquina, com um usuário. Nesse cenário a diferença de latência entre gRPC e JSON é desprezível. O ganho de gRPC aqui é de **contrato, tipagem e aprendizado de portfólio**, não de velocidade. Vale dizer isso na apresentação do projeto para não vender um ganho que não será medido.

Se você quiser uma opção sem gateway, existe também o **Connect** (`connect-es` no front, `connectrpc` no servidor). Ele fala um protocolo compatível com gRPC sobre HTTP/1.1 e HTTP/2 e funciona direto no navegador, sem Envoy. É a opção que recomendo se quisermos que o navegador conversar com o contrato `.proto` diretamente. Veja a decisão D1.

## 2. Decisões que precisam de você

**D1. Como o navegador conversa com o backend?**
- A (recomendada): BFF TypeScript com REST/JSON simples. Menos peças, mais fácil de estudar.
- B: Connect (protocolo gRPC-compatível) no navegador. Usa o mesmo `.proto` nas duas pontas, sem proxy.
- C: gRPC-Web com Envoy na frente. Mais peças para configurar; não recomendo para este projeto.

**D2. A biblioteca Python continua sem dependências?**
O README promete "Python 3.10+, sem dependências". `grpcio` e `protobuf` quebram essa promessa. Proposta: manter o núcleo (`gupy_tracker/`) sem dependências e colocar o servidor gRPC em um extra opcional (`pip install .[grpc]`). A CLI continua funcionando sem nada instalado.

**D3. Onde a interface roda?**
Proposta: somente local (`127.0.0.1`), sem autenticação, sem deploy público. O repositório é público e os dados reais ficam fora do Git (`private/`). Uma UI pública exigiria autenticação e um banco, o que foge do escopo.

## 3. Arquitetura em camadas

```
┌──────────────────────────────────────────────────────────────┐
│ UI React + TypeScript (Vite)           web/                  │
│  páginas · componentes · hooks (TanStack Query)              │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTP/JSON (D1-A) ou Connect (D1-B)
┌───────────────▼──────────────────────────────────────────────┐
│ BFF TypeScript (Node + Fastify)        server/                │
│  controladores HTTP → casos de uso → portas → cliente gRPC    │
└───────────────┬──────────────────────────────────────────────┘
                │ gRPC + Protobuf (binário, HTTP/2)
┌───────────────▼──────────────────────────────────────────────┐
│ Serviço ATS em Python (grpcio)         gupy_tracker/          │
│  adaptador gRPC → casos de uso → domínio (modelo.py)          │
│  → repositório (armazenamento.py) · planilha · relatório      │
└──────────────────────────────────────────────────────────────┘
          contrato único: proto/gupy_tracker/v1/*.proto
```

Regra de dependência: cada camada só conhece a de baixo, e o domínio não conhece ninguém. Isso é o núcleo da "arquitetura limpa" pedida.

| Camada | TypeScript (BFF e UI) | Python (ATS) |
|--------|----------------------|--------------|
| Domínio | entidades `Vaga`, `Criterios`, value objects de `Status` e `Score` | `modelo.py` (já existe, puro) |
| Aplicação | casos de uso: `ListarVagas`, `RegistrarVaga`, `AtualizarStatus`, `Ranking`, `Metricas`, `ExportarPlanilha` | funções de caso de uso extraídas da `cli.py` |
| Portas | interfaces `VagaGateway`, `RankingGateway` | `VagaRepository` (Protocol) |
| Adaptadores | cliente gRPC gerado, controladores HTTP | `armazenamento.py` (JSON), `planilha.py`, servidor gRPC |
| Apresentação | componentes React, hooks | CLI (`cli.py`), relatório Markdown |

## 4. Estrutura de pastas

```
gupy-ats-tracker/
├── proto/                       # contrato único (fonte da verdade)
│   ├── buf.yaml
│   └── gupy_tracker/v1/
│       ├── vagas.proto
│       ├── ranking.proto
│       └── planilha.proto
├── gupy_tracker/                # Python: domínio + casos de uso (existente)
│   ├── modelo.py                # regras (existente)
│   ├── armazenamento.py         # repositório JSON (existente)
│   ├── casos_de_uso.py          # NOVO: funções que a CLI e o gRPC chamam
│   └── grpc/                    # NOVO, extra opcional
│       ├── servidor.py
│       └── gerado/              # código gerado a partir de proto/
├── server/                      # NOVO: BFF TypeScript
│   ├── src/
│   │   ├── dominio/
│   │   ├── aplicacao/
│   │   ├── infraestrutura/grpc/ # cliente gerado + adaptador
│   │   └── apresentacao/http/   # rotas Fastify
│   └── test/
├── web/                         # NOVO: UI React
│   ├── src/
│   │   ├── dominio/             # tipos e regras de exibição
│   │   ├── aplicacao/           # hooks de caso de uso
│   │   ├── infraestrutura/api/  # cliente HTTP do BFF
│   │   └── apresentacao/        # páginas e componentes
│   └── test/
├── docs/
│   ├── plano-interface.md       # este documento
│   └── wiki-python/             # material de estudo (parte Python)
└── scripts/                     # dev: gerar código, subir tudo
```

## 5. Contrato Protobuf (rascunho)

```proto
syntax = "proto3";
package gupy_tracker.v1;

import "google/protobuf/empty.proto";

// Espelha STATUS em modelo.py. Mantidos em sincronia por teste.
enum Status {
  STATUS_DESCONHECIDO = 0;
  STATUS_ANALISADA = 1;
  STATUS_DESCARTADA = 2;
  STATUS_CANDIDATADA = 3;
  STATUS_TRIAGEM = 4;
  STATUS_TESTE = 5;
  STATUS_ENTREVISTA = 6;
  STATUS_OFERTA = 7;
  STATUS_RECUSADA = 8;
  STATUS_DESISTENCIA = 9;
}

enum Senioridade { SENIORIDADE_NAO_INFORMADA = 0; SENIORIDADE_JUNIOR = 1; SENIORIDADE_PLENO = 2; SENIORIDADE_SENIOR = 3; SENIORIDADE_ESPECIALISTA = 4; }

enum Modelo { MODELO_NAO_INFORMADO = 0; MODELO_REMOTO = 1; MODELO_HIBRIDO = 2; MODELO_PRESENCIAL = 3; }

message Criterios {
  int32 obrigatorios = 1;  // 0-100, peso 50
  int32 desejaveis = 2;    // 0-100, peso 15
  int32 experiencia = 3;   // 0-100, peso 15
  int32 dominio = 4;       // 0-100, peso 10
  int32 logistica = 5;     // 0-100, peso 10
}

message Vaga {
  string id = 1;
  string data = 2;                 // ISO 8601 (AAAA-MM-DD)
  string empresa = 3;
  string cargo = 4;
  Senioridade senioridade = 5;
  string area = 6;                 // dotnet | fullstack | frontend | cloud | devops | outra
  Modelo modelo = 7;
  string url = 8;
  Status status = 9;
  Criterios criterios = 10;
  int32 match_score = 11;          // calculado no servidor, nunca no cliente
  string classificacao = 12;       // "alta aderência", "aposta", ...
  repeated string palavras_chave = 13;
  repeated string lacunas = 14;
  repeated Historico historico = 15;
  // Campos de texto da Gupy. Podem ser omitidos em listagens.
  optional string descricao = 16;
  optional string responsabilidades = 17;
  optional string requisitos = 18;
}

message Historico { string data = 1; Status status = 2; }

// --- vagas ---
message ListarVagasRequest { optional Status status = 1; bool anonimo = 2; }
message ListarVagasResponse { repeated Vaga vagas = 1; }
message ObterVagaRequest { string id = 1; }
message RegistrarVagaRequest { Vaga vaga = 1; }   // id e match_score são ignorados na entrada
message AtualizarStatusRequest { string id = 1; Status novo_status = 2; string data = 3; }

service VagasService {
  rpc ListarVagas(ListarVagasRequest) returns (ListarVagasResponse);
  rpc ObterVaga(ObterVagaRequest) returns (Vaga);
  rpc RegistrarVaga(RegistrarVagaRequest) returns (Vaga);
  rpc AtualizarStatus(AtualizarStatusRequest) returns (Vaga);
}

// --- ranking e métricas ---
message RankingRequest { bool anonimo = 1; }
message RankingResponse { repeated Vaga vagas_ordenadas = 1; }
message Metricas { int32 total = 1; int32 enviadas = 2; int32 chegaram_entrevista = 3; double taxa_conversao = 4; }

service RankingService {
  rpc Ranking(RankingRequest) returns (RankingResponse);
  rpc Metricas(google.protobuf.Empty) returns (Metricas);
}

// --- planilha ---
message ExportarPlanilhaRequest { string caminho = 1; }
message ExportarPlanilhaResponse { int32 novas = 1; int32 existentes = 2; }

service PlanilhaService {
  rpc Exportar(ExportarPlanilhaRequest) returns (ExportarPlanilhaResponse);
}
```

Pontos de atenção do contrato:
- **Score calculado no servidor.** O cliente nunca recalcula o Match Score. Assim a regra fica em um lugar só (`modelo.py`).
- **`anonimo` no contrato.** Com `anonimo = true`, o serviço já devolve dados mascarados. A UI nunca recebe nomes reais que não deveria mostrar.
- **`Status` com `STATUS_DESCONHECIDO = 0`.** Padrão do proto3, para que um valor ausente não seja confundido com um status válido.
- **Campos de texto da vaga são `optional` e não vão em listagens.** Reduz o tráfego e o risco de vazar descrições em logs.
- **Versão no pacote (`v1`).** Permite evoluir o contrato sem quebrar a UI.
- **Exportação de planilha recebe caminho.** Só funciona com o serviço local. Se o serviço algum dia rodar em outra máquina, esse RPC precisa ser revisto.

## 6. Padrões de projeto

| Padrão | Onde | Para quê |
|--------|------|----------|
| Repository | `VagaRepository` (Python) e `VagaGateway` (TS) | Trocar JSON por outro armazenamento sem mexer no caso de uso |
| Adapter | cliente gRPC gerado → `VagaGateway`; `armazenamento.py` → `VagaRepository` | Isolar bibliotecas externas do domínio |
| Facade / BFF | `server/` agrupa várias chamadas gRPC em uma resposta para a tela | A UI faz uma chamada por tela |
| Strategy | pesos e critérios do Match Score (`PESOS`) | Trocar a régua sem alterar o cálculo |
| Factory | criação de `Vaga` a partir do formulário, com validação | Garantir que nenhuma vaga inválida entra no domínio |
| Mapper | `Vaga` ↔ mensagem proto ↔ JSON | Manter formatos externos fora das entidades |
| Command / Use Case | um arquivo por caso de uso, com entrada e saída tipadas | Testar sem subir servidor ou UI |
| Composition Root | `main` do servidor Python e do BFF montam as dependências | Única parte que conhece implementações concretas |
| Dependency Inversion | portas (`Protocol` em Python, `interface` em TS) | Domínio independente de frameworks |

Evitar, para não virar exibição de padrões: Singleton, herança profunda e um "framework próprio" de eventos. Um projeto pequeno não precisa deles.

## 7. Etapas em ordem

Cada etapa termina com critérios de pronto verificáveis. Não avançamos sem a anterior verde.

**Etapa 0: decisões (D1, D2, D3).** Pronto quando você aprovar este plano.

**Etapa 1: contrato e geração.**
- Criar `proto/` com `buf.yaml`, os três `.proto` e a geração de código Python e TypeScript.
- Pronto quando: `buf lint` passa; `buf generate` gera os dois lados; o comando está em `scripts/`.

**Etapa 2: extrair casos de uso no Python.**
- Mover a lógica de `cli.py` para `casos_de_uso.py`, sem mudar comportamento. A CLI passa a chamar essas funções.
- Pronto quando: os testes existentes passam e a saída dos comandos `ranking`, `metricas` e `relatorio` é idêntica à atual (teste de regressão com `vagas.json` de exemplo).

**Etapa 3: servidor gRPC em Python.**
- Implementar `VagasService`, `RankingService` e `PlanilhaService` em `gupy_tracker/grpc/`, como extra opcional.
- Pronto quando: teste de integração com cliente gRPC cria, lista e atualiza uma vaga; a CLI funciona sem `grpcio` instalado; `verificar` continua sem achados.

**Etapa 4: BFF TypeScript.**
- Cliente gRPC gerado, adaptador `VagaGateway`, casos de uso e rotas HTTP.
- Pronto quando: testes com Vitest cobrem os casos de uso com gateway falso; teste de ponta a ponta sobe o servidor Python e chama uma rota HTTP.

**Etapa 5: UI React.**
- Telas: ranking (com filtro de status e faixa de score), detalhe da vaga, formulário de nova vaga, mudança de status, painel de métricas.
- Pronto quando: Testing Library cobre as telas principais; a tela de ranking funciona com a opção anônima ligada; Lighthouse de acessibilidade sem erros graves.

**Etapa 6: exportação e revisão de privacidade.**
- Botão de exportar planilha (chama `PlanilhaService`); rodar `verificar` sobre todo o código novo.
- Pronto quando: o exportar gera a mesma planilha que `ranking --planilha`; `verificar --staged` passa no pre-commit.

**Etapa 7: documentação e wiki.**
- Atualizar o README com a nova forma de rodar; mover o material de estudo Python para `docs/wiki-python/`.
- Pronto quando: um passo a passo de `git clone` até a tela funciona em uma máquina limpa.

## 8. Riscos

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Expectativa errada de que o navegador fala gRPC puro | Alta (já identificado) | D1 explica a limitação; usar BFF ou Connect |
| `grpcio` quebra a promessa "sem dependências" | Alta se não isolarmos | D2: extra opcional; CLI continua sem dependências |
| Dados reais vazarem para o Git (repositório público) | Média | `private/` fora do Git; `verificar` cobre arquivos novos; nenhum dado real em fixtures de teste |
| Regra do Match Score duplicada em Python e TS | Média | Score só no servidor; testes de vetores compartilhados se algum dia o cliente precisar |
| Escopo crescer além do portfólio (auth, banco, deploy) | Média | Fora de escopo nesta fase; registrado como próximos passos |
| Escrita concorrente no JSON (CLI e UI ao mesmo tempo) | Baixa (uso individual) | Escrita atômica com arquivo temporário e renomeação; lock simples se necessário |
| Complexidade demais para estudo | Média | Começar pela Etapa 2; cada etapa é um PR separado |
| Planilha `.xlsx` aberta no Excel travar a exportação | Média | Mensagem de erro clara; exportar para cópia temporária |

## 9. O que fica na parte Python

Fica como está, e é a fonte de verdade das regras:
- `modelo.py`: pesos, faixas, funil de status, validação de vaga.
- `armazenamento.py`: leitura e escrita do `vagas.json`.
- `relatorio.py`: métricas, ranking e relatório Markdown.
- `planilha.py`: exportação para a planilha de controle.
- `vazamento.py` e o comando `verificar`: proteção de dados.
- `cli.py`: continua funcionando como hoje, para quem prefere o terminal.

Muda pouco: extrai casos de uso (Etapa 2) e ganha o adaptador gRPC opcional (Etapa 3). O material de estudo vai para `docs/wiki-python/`, com explicações dos padrões usados.

## 10. Próximo passo

Se você aprovar, eu começo pela Etapa 1 (contrato e geração) em PR separado. Antes disso, preciso de três respostas:
1. **D1:** REST simples (A), Connect no navegador (B) ou outra?
2. **D2:** aceita o servidor gRPC como extra opcional?
3. **D3:** confirma que a interface fica só local?
