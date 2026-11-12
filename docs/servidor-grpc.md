# Servidor gRPC (opcional)

O tracker tem um servidor gRPC local, para uma interface ou outro serviço conversar com ele pelo contrato em `proto/`. A CLI continua funcionando sem nada disso.

## Como rodar

```bash
pip install .[grpc]                  # grpcio e protobuf
sh scripts/gerar_proto.sh            # gera gupy_tracker/v1/ a partir de proto/
python -m gupy_tracker.servidor_grpc --dados private/vagas.json
```

Para gerar o código, o script usa o `python3` do sistema. Se o `grpcio-tools` estiver em um ambiente virtual, rode com `PYTHON=caminho/do/python sh scripts/gerar_proto.sh`.

## Regras

- **Só loopback.** O servidor aceita `127.0.0.1` ou `localhost`, e recusa outros endereços. Não há autenticação.
- **Dados reais.** Vale a mesma regra da CLI: o arquivo fica em `private/` e nunca vai para o Git.
- **Anonimato.** Com `anonimo=true`, o serviço aplica a mesma anonimização de `relatorio.anonimizar`, em listagem, ranking e detalhe.
- **Código gerado não vai para o Git.** Os `*_pb2*.py` estão no `.gitignore`.
