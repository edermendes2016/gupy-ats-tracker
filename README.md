# Gupy Tracker

Ferramenta para organizar uma busca de emprego na [Gupy](https://portal.gupy.io/). Cada vaga recebe um **Match Score** (de 0 a 100%) que mede a aderência ao currículo, e o painel mostra o funil de candidaturas: candidatura, entrevista e oferta.

Tudo roda na sua máquina, com Docker. Os dados ficam em pastas locais e nunca entram na imagem.

## Rodar com Docker (recomendado)

Só é preciso ter o [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado. Na pasta do projeto:

```
docker compose up --build
```

Depois abra **http://127.0.0.1:3000** no navegador.

O passo a passo completo, com Windows, macOS e Linux, está na wiki: **[Como instalar e rodar com Docker](docs/docker.md)**.

## Exemplo no terminal

Também há uma versão de linha de comando, que só precisa de Python 3.10+ e não usa dependências:

```console
$ python -m gupy_tracker ranking
 #  MATCH  STATUS       EMPRESA                  CARGO
 1    87%  entrevista   ACME Sistemas (fictícia) Desenvolvedor .NET Pleno  [alta aderência]
 2    73%  recusada     Initech (fictícia)       Desenvolvedor Full Stack Sênior  [boa aderência]
 3    56%  candidatada  Globex (fictícia)        Engenheiro Cloud AWS Júnior  [aposta]
 4    28%  descartada   Umbrella (fictícia)      Desenvolvedor Java Sênior  [não vale o esforço]
```

Para começar: `git clone` do repositório, entrar na pasta e rodar `python -m gupy_tracker ranking`. Os exemplos acima usam dados fictícios de `data/exemplo/`.

## Documentação

- [Como instalar e rodar com Docker](docs/docker.md): para quem só quer ver o projeto funcionando
- [Como usar](docs/como-usar.md): passo a passo da linha de comando
- [Comandos](docs/comandos.md): referência de comandos, opções e status
- [Metodologia do Match Score](docs/match-score.md): critérios, pesos e faixas
- [Proteção de dados](docs/protecao-de-dados.md): como os dados pessoais ficam fora do Git
- [Servidor gRPC](docs/servidor-grpc.md): serviço local opcional
- [Wiki da parte Python](docs/wiki-python/README.md): organização do código e padrões usados
