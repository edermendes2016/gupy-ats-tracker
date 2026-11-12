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

## Interface web com Docker (recomendado)

Com Docker instalado, um comando sobe tudo (serviço gRPC, BFF e interface):

```
docker compose up --build
```

Abra http://127.0.0.1:3000. Detalhes, Windows e onde ficam os dados: [Rodar com Docker](docs/docker.md).

## Interface web sem Docker (opcional)

Precisa de Python 3.10+ e Node 20+. Os comandos funcionam no Windows (cmd, PowerShell ou Git Bash), no macOS e no Linux. Abra três terminais dentro da pasta do projeto.

**Terminal 1: serviço Python (gRPC)**

```
python -m pip install ".[grpc]" grpcio-tools
python scripts/gerar_proto.py
python -m gupy_tracker.servidor_grpc
```

O último comando usa `private/vagas.json`. Você não precisa criar a pasta nem o arquivo: eles são criados quando a primeira vaga for salva. Se quiser outro arquivo, use `python -m gupy_tracker.servidor_grpc --dados caminho/do/vagas.json`.

**Terminal 2: BFF (HTTP para a interface)**

```
cd server
npm install
npm start
```

**Terminal 3: interface**

```
cd web
npm install
npm run dev
```

Depois, abra http://127.0.0.1:5173 no navegador.

Arquitetura e decisões: [plano da interface](docs/plano-interface.md). Detalhes do servidor: [servidor gRPC](docs/servidor-grpc.md).

## Documentação

- [Como usar](docs/como-usar.md): passo a passo, do download ao primeiro ranking
- [Rodar com Docker](docs/docker.md): um comando sobe tudo, Windows incluso
- [Comandos](docs/comandos.md): referência de comandos, opções e status
- [Metodologia do Match Score](docs/match-score.md): os cinco critérios, pesos e faixas
- [Proteção de dados](docs/protecao-de-dados.md): como nada sensível vai para o Git
- [Wiki da parte Python](docs/wiki-python/README.md): estudo do código e padrões de projeto
