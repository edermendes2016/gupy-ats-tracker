# Servidor gRPC (opcional)

O tracker tem um servidor gRPC local, para uma interface ou outro serviço conversar com ele pelo contrato em `proto/`. A CLI continua funcionando sem nada disso.

## Como rodar

Os comandos abaixo valem para Windows, macOS e Linux. Rode a partir da raiz do repositório.

```
python -m pip install ".[grpc]" grpcio-tools
python scripts/gerar_proto.py
python -m gupy_tracker.servidor_grpc
```

- `scripts/gerar_proto.py` gera `gupy_tracker/v1/` a partir de `proto/`. Ele usa o mesmo Python que está rodando, então não depende de `sh` nem de `python3`.
- Sem `--dados`, o servidor usa `private/vagas.json` e cria o arquivo na primeira gravação.

## Regras

- **Só loopback.** O servidor aceita `127.0.0.1` ou `localhost`, e recusa outros endereços. Não há autenticação.
- **Dados reais.** Vale a mesma regra da CLI: o arquivo fica em `private/` e nunca vai para o Git.
- **Anonimato.** Com `anonimo=true`, o serviço aplica a mesma anonimização de `relatorio.anonimizar`, em listagem, ranking e detalhe.
- **Código gerado não vai para o Git.** Os `*_pb2*.py` estão no `.gitignore`.
