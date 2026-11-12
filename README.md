# gupy-ats-tracker

Registro e ranking das minhas candidaturas na [Gupy](https://portal.gupy.io/), com um **Match Score** por vaga e métricas de conversão do funil (candidatura → entrevista → oferta).

A ideia é tratar a busca de emprego como um problema de engenharia: medir a aderência antes de gastar esforço, registrar o resultado e descobrir a partir de qual score vale a pena se candidatar.

> **Privacidade em primeiro lugar.** Este repositório é público, então ele guarda só código, metodologia e dados fictícios. Currículo, descrições de vagas, respostas e nomes de empresas reais ficam fora do Git. Veja [Proteção de dados](docs/protecao-de-dados.md).

## Exemplo (dados fictícios)

```console
$ python -m gupy_tracker ranking
 #  MATCH  STATUS       EMPRESA                  CARGO
 1    87%  entrevista   ACME Sistemas (fictícia) Desenvolvedor .NET Pleno  [alta aderência]
 2    73%  recusada     Initech (fictícia)       Desenvolvedor Full Stack Sênior  [boa aderência]
 3    56%  candidatada  Globex (fictícia)        Engenheiro Cloud AWS Júnior  [aposta]
 4    28%  descartada   Umbrella (fictícia)      Desenvolvedor Java Sênior  [não vale o esforço]
```

## Começo rápido

Requer apenas Python 3.10+ (sem dependências).

```bash
git clone https://github.com/edermendes2016/gupy-ats-tracker.git
cd gupy-ats-tracker
python -m gupy_tracker ranking
```

## Interface web (opcional)

Para quem prefere uma tela. São três processos, todos locais (`127.0.0.1`):

```bash
pip install .[grpc]                                   # grpcio e protobuf
sh scripts/gerar_proto.sh                             # gera gupy_tracker/v1/
python -m gupy_tracker.servidor_grpc --dados private/vagas.json   # terminal 1: gRPC na porta 50051

cd server && npm install && npm start                 # terminal 2: BFF em http://127.0.0.1:3000

cd web && npm install && npm run dev                  # terminal 3: interface em http://127.0.0.1:5173
```

Arquitetura e decisões: [plano da interface](docs/plano-interface.md). Detalhes do servidor: [servidor gRPC](docs/servidor-grpc.md).

## Documentação

- [Como usar](docs/como-usar.md): passo a passo, do download ao primeiro ranking
- [Comandos](docs/comandos.md): referência de comandos, opções e status
- [Metodologia do Match Score](docs/match-score.md): os cinco critérios, pesos e faixas
- [Proteção de dados](docs/protecao-de-dados.md): como nada sensível vai para o Git
- [Wiki da parte Python](docs/wiki-python/README.md): estudo do código e padrões de projeto
