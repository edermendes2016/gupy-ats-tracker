# Padrões de projeto na parte Python

Cada padrão abaixo tem um exemplo real no código. Os nomes em português são os do projeto.

## Repository

O `armazenamento.py` é o único lugar que sabe que os dados estão em JSON. Quem chama usa `carregar(caminho)` e `salvar(caminho, vagas)`. Trocar o JSON por SQLite exigiria mexer só nesse arquivo.

Ponto de atenção: `salvar` escreve em um `.tmp` e depois renomeia. Assim, uma falha no meio da escrita não corrompe o arquivo original.

## Use case (caso de uso)

Em `casos_de_uso.py`, cada função faz uma coisa do ponto de vista do usuário: `registrar_vaga`, `atualizar_status`, `achar_vaga`, `resumo_score`. Elas:

- recebem dados prontos, não `argparse`;
- não imprimem nada;
- lançam exceções próprias (`VagaDuplicada`, `VagaNaoEncontrada`, `CurriculoSemNome`) em vez de `SystemExit`.

Quem decide a mensagem para o usuário é a CLI ou o servidor. Por isso o mesmo caso de uso serve às duas interfaces.

## Strategy (com dados)

`PESOS` em `modelo.py` é a régua do Match Score. `calcular_match_score` lê o dicionário inteiro, então mudar um peso não exige mudar o cálculo. É uma estratégia "com dados", mais simples que uma classe por critério, adequada para um projeto deste tamanho.

## Adapter

`conversao_proto.py` adapta o dicionário da vaga para a mensagem Protobuf, e o caminho inverso. O resto do código não sabe o que é um `pb.Vaga`. Os nomes dos enums (`STATUS_ENTREVISTA`) são convertidos aqui, e em nenhum outro lugar.

## Composition root

Só `cli.py` e `servidor_grpc.py` montam as dependências (caminho do arquivo, trava, endereço). Os módulos de domínio e de aplicação recebem o que precisam por parâmetro.

## Exceções como contrato

Os casos de uso lançam tipos de erro, e cada interface traduz para o próprio meio: a CLI mostra a mensagem e sai com código 1; o servidor devolve `NOT_FOUND`, `ALREADY_EXISTS` ou `INVALID_ARGUMENT`. As duas interfaces partem das mesmas exceções, mas nem todas as mensagens são idênticas: a CLI acrescenta prefixos como "vaga inválida:", e o gRPC repassa o texto puro no detalhe do status. Padronizar isso (um catálogo de mensagens ou códigos de erro) é um bom próximo passo de estudo.

## Testes como documentação

Os testes em `tests/` são a forma mais rápida de entender uma regra. `test_casos_de_uso.py` mostra o comportamento sem CLI; `test_tracker.py` mostra o comportamento pela CLI.
