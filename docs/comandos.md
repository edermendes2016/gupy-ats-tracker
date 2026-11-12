# Comandos

Todos são executados da raiz do projeto, no formato `python -m gupy_tracker <comando>`. Use `--help` em qualquer um para ver as opções.

| Comando | O que faz |
|---------|-----------|
| `adicionar` | Registra uma vaga analisada e mostra o Match Score |
| `analisar --cv arquivo` | Calcula os cinco critérios, o Match Score, as palavras-chave e as lacunas a partir do texto da vaga e do currículo (`--salvar --empresa --cargo` registra a vaga) |
| `status <id> <novo_status>` | Atualiza o status de uma vaga (aceita um trecho do id) |
| `ranking` | Mostra o ranking no terminal (`--anonimo` esconde os nomes; `--planilha` preenche a planilha de controle) |
| `metricas` | Funil e taxa de conversão em JSON |
| `relatorio` | Gera o ranking em Markdown, anônimo por padrão (`--saida arquivo.md`, `--com-nomes`) |
| `verificar` | Procura nomes de empresas reais nos arquivos versionáveis (`--staged` olha só o stage) |

## Opções do `adicionar`

Obrigatórias: `--empresa`, `--cargo` e as cinco notas de 0 a 100 (`--obrigatorios`, `--desejaveis`, `--experiencia`, `--dominio`, `--logistica`).

| Opção | Valores |
|-------|---------|
| `--senioridade` | `junior`, `pleno`, `senior`, `especialista` |
| `--area` | `dotnet`, `fullstack`, `frontend`, `cloud`, `devops`, `outra` |
| `--modelo` | `remoto`, `hibrido`, `presencial` |
| `--status` | veja a lista abaixo (padrão: `analisada`) |
| `--data` | `AAAA-MM-DD` (padrão: hoje) |
| `--url` | link da vaga (nunca aparece no relatório público) |
| `--palavra-chave` | termo da vaga que o seu currículo cobre; pode repetir |
| `--lacuna` | requisito que o seu currículo não cobre; pode repetir |
| `--fonte` | onde a vaga foi encontrada (padrão: `Gupy`) |
| `--curriculo` | `perfil-gupy` (padrão) ou `outro` |
| `--nome-curriculo` | nome do arquivo quando `--curriculo outro` (só o nome, nunca o conteúdo) |
| `--descricao` | campo **Descrição da vaga** da Gupy (texto, ou `@arquivo.txt`) |
| `--responsabilidades` | campo **Responsabilidades e atribuições** (texto, ou `@arquivo.txt`) |
| `--requisitos` | campo **Requisitos e qualificações** (texto, ou `@arquivo.txt`) |

## Status do funil

`analisada`, `descartada`, `candidatada`, `triagem`, `teste`, `entrevista`, `oferta`, `recusada`, `desistencia`.

Contam como candidatura enviada todos menos `analisada` e `descartada`. Contam como "chegou à entrevista" os status `entrevista` e `oferta`.

## Arquivo de dados

A ordem de escolha é: `--dados caminho/vagas.json` (antes do comando), a variável `GUPY_TRACKER_DADOS`, `private/vagas.json` e, só para leitura, os dados de exemplo. Os comandos que gravam (`adicionar` e `status`) nunca alteram os dados de exemplo.

## Planilha de controle

`ranking --planilha ARQUIVO.xlsx` acrescenta uma linha por vaga às colunas do modelo: Data de Inscrição, Empresa, Cargo, Status, Palavras-Chave da Vaga, Lacuna, Fonte e Link da vaga. Vagas que já estão na planilha (mesma empresa e cargo) não são duplicadas. Formatação e tabela da planilha são preservadas, e a escrita usa só a biblioteca padrão do Python.
