# Wiki: parte Python do tracker

Material de estudo sobre a biblioteca `gupy_tracker/`. O código é pequeno de propósito: cada arquivo tem uma responsabilidade, e os padrões abaixo aparecem de forma concreta.

## Mapa do código

| Arquivo | Responsabilidade | Camada |
|---------|------------------|--------|
| `modelo.py` | pesos, faixas, funil de status e validação | domínio |
| `casos_de_uso.py` | registrar vaga, atualizar status, resumir score | aplicação |
| `armazenamento.py` | leitura e escrita do JSON, com escrita atômica | infraestrutura |
| `planilha.py` | exportação para a planilha de controle | infraestrutura |
| `relatorio.py` | ranking, métricas, anonimização e Markdown | aplicação / apresentação |
| `vazamento.py` | procura dados privados em arquivos versionáveis | apoio |
| `cli.py` | comandos de terminal | apresentação |
| `conversao_proto.py`, `servidor_grpc.py` | servidor gRPC opcional | apresentação |

Regra de dependência: a CLI e o servidor conhecem os casos de uso; os casos de uso conhecem o domínio; o domínio não conhece ninguém.

## Padrões usados

Veja [padroes.md](padroes.md) para a explicação de cada um, com links para o código.

- **Repository**: o `armazenamento.py` esconde o JSON atrás de `carregar` e `salvar`.
- **Use case**: funções em `casos_de_uso.py` que não imprimem nada e lançam exceções próprias.
- **Strategy (pesos)**: o `PESOS` em `modelo.py` define a régua; trocar a régua não mexe no cálculo.
- **Adapter**: `conversao_proto.py` traduz o dicionário da vaga para a mensagem Protobuf.
- **Composition root**: `cli.py` e `servidor_grpc.py` são os únicos lugares que montam as dependências.

## Como estudar

1. Leia `modelo.py` inteiro: é o domínio, sem entrada/saída e fácil de testar.
2. Leia `casos_de_uso.py` e compare com a `cli.py` antiga (histórico do git, PR #4).
3. Rode `python -m unittest discover -s tests -v` e veja quais testes cobrem cada regra.
4. Depois, veja o servidor gRPC em [servidor-grpc.md](../servidor-grpc.md).
