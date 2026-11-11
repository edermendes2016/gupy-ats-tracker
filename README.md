# gupy-ats-tracker

Registro e ranking das minhas candidaturas na [Gupy](https://portal.gupy.io/), com um **Match Score** por vaga e métricas de conversão do funil (candidatura → entrevista → oferta).

A ideia é tratar a busca de emprego como um problema de engenharia: medir a aderência antes de gastar esforço, registrar o resultado e descobrir a partir de qual score vale a pena se candidatar.

> **Privacidade em primeiro lugar.** Este repositório é público, então ele guarda só código, metodologia e dados fictícios. Currículo, descrições de vagas, respostas e nomes de empresas reais ficam fora do Git. Veja [Proteção de dados](#proteção-de-dados).

## Como funciona

Cada vaga recebe cinco notas de 0 a 100, combinadas em uma média ponderada:

| Critério | Peso | O que mede |
|----------|-----:|------------|
| `obrigatorios` | 50% | Requisitos obrigatórios que o currículo comprova |
| `desejaveis` | 15% | Diferenciais e requisitos desejáveis |
| `experiencia` | 15% | Tempo e nível de experiência pedidos x reais |
| `dominio` | 10% | Setor, tipo de produto e contexto de negócio |
| `logistica` | 10% | Modelo de trabalho, localidade, contratação, idioma |

Abaixo de **40%** a vaga é marcada como "não vale o esforço". Os detalhes estão em [docs/match-score.md](docs/match-score.md).

## Exemplo (dados fictícios)

```console
$ python -m gupy_tracker ranking
 #  MATCH  STATUS       EMPRESA                  CARGO
 1    87%  entrevista   ACME Sistemas (fictícia) Desenvolvedor .NET Pleno  [alta aderência]
 2    73%  recusada     Initech (fictícia)       Desenvolvedor Full Stack Sênior  [boa aderência]
 3    56%  candidatada  Globex (fictícia)        Engenheiro Cloud AWS Júnior  [aposta]
 4    28%  descartada   Umbrella (fictícia)      Desenvolvedor Java Sênior  [não vale o esforço]
```

## Uso

Requer apenas Python 3.10+ (sem dependências).

```bash
# registrar uma vaga analisada (grava em private/vagas.json, que o Git ignora)
python -m gupy_tracker --dados private/vagas.json adicionar \
  --empresa "Nome da Empresa" --cargo "Desenvolvedor .NET Pleno" \
  --senioridade pleno --area dotnet --modelo remoto --status candidatada \
  --obrigatorios 85 --desejaveis 60 --experiencia 90 --dominio 70 --logistica 100 \
  --palavra-chave "CQRS" --lacuna "Kafka"

python -m gupy_tracker status <id-ou-trecho> entrevista   # avançar no funil
python -m gupy_tracker ranking                            # ranking no terminal
python -m gupy_tracker metricas                           # funil e conversão (JSON)
python -m gupy_tracker relatorio --saida RANKING.md       # Markdown anônimo, pronto para publicar
python -m gupy_tracker verificar                          # procura nomes reais em arquivos versionáveis
```

O arquivo de dados é escolhido nesta ordem: `--dados`, variável `GUPY_TRACKER_DADOS`, `private/vagas.json` e, por último, os dados de exemplo.

Status do funil: `analisada`, `descartada`, `candidatada`, `triagem`, `teste`, `entrevista`, `oferta`, `recusada`, `desistencia`.

## Proteção de dados

Três camadas impedem que algo sensível seja publicado:

1. **`.gitignore`**: `private/`, tudo em `data/` fora de `data/exemplo/`, currículos (`*.pdf`, `*.docx`), capturas de tela e arquivos de credenciais nunca são versionados.
2. **Relatório anônimo por padrão**: `relatorio` troca cada empresa por um apelido estável ("Empresa 01"), remove a URL e reduz a data a ano e mês. Nomes reais só saem com `--com-nomes`, para uso local.
3. **Verificação antes do commit**: `verificar` lê os nomes das empresas dos dados privados (e termos extras de `private/termos-privados.txt`) e falha se algum aparecer em um arquivo versionável. Para rodar em todo commit:

   ```bash
   git config core.hooksPath scripts/hooks
   ```

## Estrutura

```
gupy_tracker/     CLI: modelo e Match Score, armazenamento, relatório, verificação de vazamento
data/exemplo/     vagas fictícias usadas na documentação e nos testes
docs/             metodologia do Match Score
templates/        modelo de ficha por vaga (as fichas preenchidas ficam em private/)
scripts/hooks/    pre-commit que bloqueia nomes de empresas reais
tests/            testes (unittest)
```

## Testes

```bash
python -m unittest discover -s tests
```
