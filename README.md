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

## Como usar

Você só precisa do [Python 3.10 ou mais novo](https://www.python.org/downloads/) e do Git. Não há nada para instalar com `pip`.

> No Windows, se o comando `python` não funcionar, use `py` no lugar. No Linux e no macOS, use `python3`.

### 1. Baixe o projeto

```bash
git clone https://github.com/edermendes2016/gupy-ats-tracker.git
cd gupy-ats-tracker
```

Todos os comandos abaixo são executados de dentro dessa pasta.

### 2. Veja funcionando com os dados de exemplo

```bash
python -m gupy_tracker ranking
```

Deve aparecer o ranking com quatro vagas fictícias, igual ao exemplo acima. Se apareceu, está tudo certo.

### 3. Registre a sua primeira vaga

Leia a descrição da vaga e dê uma nota de 0 a 100 para cada um dos cinco critérios (a tabela em [docs/match-score.md](docs/match-score.md) explica como pontuar). Depois rode:

```bash
python -m gupy_tracker adicionar --empresa "Nome da Empresa" --cargo "Desenvolvedor .NET Pleno" --senioridade pleno --area dotnet --modelo remoto --status candidatada --obrigatorios 85 --desejaveis 60 --experiencia 90 --dominio 70 --logistica 100
```

O programa responde com o Match Score calculado:

```
2026-11-11-nome-da-empresa-desenvolvedor-net-pleno: Match Score 82% (alta aderência)
```

Na primeira vez, isso cria o arquivo `private/vagas.json`. É nele que ficam as suas vagas reais, e o Git ignora essa pasta. A partir daí os comandos passam a usar os seus dados em vez dos de exemplo.

Opções úteis do `adicionar`:

| Opção | Valores |
|-------|---------|
| `--senioridade` | `junior`, `pleno`, `senior`, `especialista` |
| `--area` | `dotnet`, `fullstack`, `frontend`, `cloud`, `devops`, `outra` |
| `--modelo` | `remoto`, `hibrido`, `presencial` |
| `--status` | veja a lista no passo 4 (padrão: `analisada`) |
| `--data` | `AAAA-MM-DD` (padrão: hoje) |
| `--url` | link da vaga (nunca aparece no relatório público) |
| `--palavra-chave` | termo da vaga que o seu currículo cobre; pode repetir |
| `--lacuna` | requisito que o seu currículo não cobre; pode repetir |

### 4. Atualize o status quando o processo andar

```bash
python -m gupy_tracker status nome-da-empresa entrevista
```

Basta um trecho do id da vaga (aqui, `nome-da-empresa`). Os status possíveis são: `analisada`, `descartada`, `candidatada`, `triagem`, `teste`, `entrevista`, `oferta`, `recusada` e `desistencia`.

### 5. Acompanhe o ranking e a conversão

```bash
python -m gupy_tracker ranking                        # ranking no terminal
python -m gupy_tracker metricas                       # funil e taxa de conversão
python -m gupy_tracker relatorio --saida RANKING.md   # relatório anônimo em Markdown
```

O `RANKING.md` gerado troca os nomes das empresas por "Empresa 01", "Empresa 02" etc., então pode ser publicado.

### 6. (Opcional) Ative a trava contra vazamentos

```bash
git config core.hooksPath scripts/hooks
```

Depois disso, todo `git commit` verifica se o nome de alguma empresa das suas vagas aparece nos arquivos e, se aparecer, o commit é bloqueado. Para rodar a verificação na mão: `python -m gupy_tracker verificar`.

### Onde ficam os dados

Por padrão, em `private/vagas.json`. Para guardar em outro lugar (uma pasta sincronizada, por exemplo), passe `--dados caminho/vagas.json` antes do comando ou defina a variável de ambiente `GUPY_TRACKER_DADOS`.

## Proteção de dados

Três camadas impedem que algo sensível seja publicado:

1. **`.gitignore`**: `private/`, tudo em `data/` fora de `data/exemplo/`, currículos (`*.pdf`, `*.docx`), capturas de tela e arquivos de credenciais nunca são versionados.
2. **Relatório anônimo por padrão**: `relatorio` troca cada empresa por um apelido estável ("Empresa 01"), remove a URL e reduz a data a ano e mês. Nomes reais só saem com `--com-nomes`, para uso local.
3. **Verificação antes do commit**: `verificar` lê os nomes das empresas dos dados privados (e termos extras de `private/termos-privados.txt`, um por linha) e falha se algum aparecer em um arquivo versionável.

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
