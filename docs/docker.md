# Como instalar e rodar com Docker

Este guia mostra como rodar o Gupy Tracker no seu computador, sem instalar Python nem Node. Você só precisa do Docker. Tudo roda localmente: ninguém mais na rede acessa o sistema.

## 1. Instale o Docker

- **Windows e macOS:** instale o [Docker Desktop](https://www.docker.com/products/docker-desktop/). Abra o programa e espere ele terminar de iniciar (o ícone de baleia fica parado).
- **Linux:** instale o Docker Engine com o plugin Compose.

## 2. Baixe o projeto

Com Git:

```
git clone https://github.com/edermendes2016/gupy-ats-tracker.git
cd gupy-ats-tracker
```

Sem Git: na página do repositório no GitHub, clique em **Code → Download ZIP**, descompacte a pasta e abra o terminal dentro dela.

## 3. Suba o sistema

Na pasta do projeto, rode:

```
docker compose up --build
```

A primeira vez demora alguns minutos, porque o Docker monta a imagem. Deixe esse terminal aberto enquanto usa o sistema.

## 4. Abra no navegador

Acesse **http://127.0.0.1:3000**

Para desligar, volte ao terminal e aperte `Ctrl+C`. Para remover os contêineres depois, rode `docker compose down`. Os seus dados continuam nas pastas do projeto.

## 5. (Opcional) Veja com dados de exemplo

Ao começar, o sistema aparece vazio. Para ver como ele funciona com vagas fictícias, copie o arquivo de exemplo para a pasta de dados:

- **Windows (PowerShell):**
  ```
  mkdir private
  copy data\exemplo\vagas.json private\vagas.json
  ```
- **macOS ou Linux:**
  ```
  mkdir -p private
  cp data/exemplo/vagas.json private/vagas.json
  ```

Depois, recarregue a página. As empresas são fictícias.

## 6. Use as abas

- **Ranking:** as vagas em ordem de Match Score. Quanto maior, mais aderente ao currículo.
- **Vagas:** a lista completa. Dá para filtrar por status e mudar o status de cada vaga.
- **Métricas:** o funil de candidaturas (quantas viraram entrevista e quantas viraram oferta).
- **Nova vaga:** cadastra uma vaga. Envie um currículo em PDF, DOCX, TXT ou MD e cole o texto da vaga. Clique em **Analisar currículo** e o sistema preenche as notas dos critérios. Confira antes de salvar.

## 7. (Opcional) Use uma planilha de controle

Se você acompanha as candidaturas em uma planilha Excel, o sistema pode preenchê-la.

1. Crie uma pasta chamada `planilhas` dentro da pasta do projeto e coloque nela o arquivo `.xlsx`. Se ainda não tiver planilha, pule para o item 3 e o sistema cria uma.
2. Na página, na seção de planilha, digite o caminho **dentro do contêiner**: `/app/planilhas/nome-do-arquivo.xlsx`. O botão **Abrir planilha** não funciona com Docker, então digite o caminho.
3. Para criar uma planilha nova, clique em **Gerar planilha** e informe `/app/planilhas/controle.xlsx`.
4. Clique em **Exportar planilha**. O sistema adiciona uma linha para cada vaga que ainda não está na planilha. Vagas já existentes não são duplicadas.

Observação: o sistema preenche a planilha a partir das vagas cadastradas. Ele não importa linhas de uma planilha existente.

## 8. Modo anônimo

No topo da página, marque **Modo anônimo**. Com ele ligado:

- empresas, cargos, datas e links ficam escondidos;
- o status das vagas não pode ser alterado;
- a exportação para planilha fica desligada;
- na aba **Métricas**, o botão **Compartilhar** gera um cartão só com números agregados, sem nomes de empresas.

Use o modo anônimo para mostrar o sistema a outras pessoas sem expor a sua busca.

## Onde ficam os dados

Nada pessoal entra na imagem do Docker. Os dados ficam em pastas do seu computador:

| Pasta no seu computador | O que guarda |
|---|---|
| `private/` | as vagas cadastradas (`vagas.json`) |
| `planilhas/` | a planilha de controle `.xlsx` |

## Problemas comuns

- **"Cannot connect to the Docker daemon" ou comando não encontrado:** abra o Docker Desktop e espere ele iniciar.
- **A página não abre:** confira se o terminal mostra o sistema em execução. Se a porta 3000 já estiver em uso, feche o outro programa que a usa.
- **O contêiner reinicia sem parar, com a mensagem `no such file or directory`:** o arquivo foi baixado com fim de linha do Windows. Rode `git pull` e depois `docker compose build --no-cache`, e suba de novo com `docker compose up`.
- **Erro de compartilhamento de pasta no Windows ou macOS:** no Docker Desktop, em *Settings → Resources → File sharing*, confirme que a pasta do projeto está liberada.
- **Reconstruir do zero:** `docker compose build --no-cache`.
