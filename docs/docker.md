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

A planilha de controle é feita pela própria página, sem digitar caminho nenhum:

1. Clique em **Baixar modelo** e salve o arquivo no seu computador.
2. Preencha a planilha no Excel ou no Google Planilhas, sem renomear as colunas da linha 2.
3. Clique em **Enviar planilha preenchida** e escolha o arquivo. O sistema acrescenta as vagas do ranking, sem duplicar as que já estão lá.
4. Clique em **Baixar planilha atualizada** e use essa versão como sua planilha de controle.

Não é preciso montar nenhuma pasta no Docker: o arquivo vai e volta pelo navegador. Se você enviar outro arquivo (um PDF, ou uma planilha de outro modelo), a página recusa e explica o motivo. O botão **Tutorial**, na mesma seção, mostra esses passos.

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
