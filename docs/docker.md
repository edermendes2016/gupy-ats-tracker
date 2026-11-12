# Rodar com Docker

Sobe o serviço Python (gRPC), o BFF e a interface com **um comando**. Não precisa instalar Python nem Node na sua máquina; só o Docker.

## Pré-requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows e macOS) ou Docker Engine (Linux), com o Compose incluído.

## Subir

Na pasta do projeto:

```
docker compose up --build
```

Depois, abra http://127.0.0.1:3000. Para parar, `Ctrl+C` ou `docker compose down`.

### Windows (PowerShell ou cmd)

```
docker compose up --build
```

Os mesmos comandos valem no Windows. Se a planilha estiver em outra pasta, crie um arquivo `.env` (copie `.env.example`) e aponte `GUPY_PLANILHAS` para ela, por exemplo:

```
GUPY_PLANILHAS=C:\Users\voce\Documents\Gupy
```

## Onde ficam os dados

Nada pessoal entra na imagem. Tudo vem por volume, pelo `docker-compose.yml`:

| No seu computador | Dentro do contêiner | O que é |
|---|---|---|
| `./private/` | `/app/private/` | `vagas.json`, criado na primeira vaga salva |
| `$GUPY_PLANILHAS` (padrão `./planilhas/`) | `/app/planilhas/` | sua planilha `.xlsx` |

Na aba de planilha da interface, use o caminho **dentro do contêiner**, por exemplo `/app/planilhas/acompanhamento.xlsx`. No Windows, o botão de escolher arquivo não funciona dentro do Docker: digite o caminho.

O `.dockerignore` nega tudo por padrão e só libera o código. `private/`, `data/` (fora de `data/exemplo/`), currículos, capturas de tela e planilhas nunca vão para a imagem. `tests/test_docker.py` verifica isso.

## Como funciona

- Uma imagem, dois processos: o serviço gRPC escuta só em `127.0.0.1` dentro do contêiner (ele recusa outros endereços) e o BFF, na porta 3000, entrega a API e a interface.
- O `.proto` é compilado durante o build (`python scripts/gerar_proto.py`), então o código gerado nunca precisa ir para o Git.
- A porta é publicada só em `127.0.0.1`: o serviço não fica acessível de outras máquinas da rede.

## Problemas comuns

- **Erro de volume no Windows**: confira em Docker Desktop, *Settings → Resources → File sharing*, se a pasta do projeto (e a da planilha) estão liberadas.
- **Leitura de PDF**: a imagem já inclui o `pdftotext` (poppler).
- **Recriar do zero**: `docker compose build --no-cache`.
