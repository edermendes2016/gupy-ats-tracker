# Como usar

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

Deve aparecer o ranking com quatro vagas fictícias, igual ao exemplo do [README](../README.md). Se apareceu, está tudo certo.

### 3. Registre a sua primeira vaga

Leia a descrição da vaga e dê uma nota de 0 a 100 para cada um dos cinco critérios (a tabela em [docs/match-score.md](match-score.md) explica como pontuar). Depois rode:

```bash
python -m gupy_tracker adicionar --empresa "Nome da Empresa" --cargo "Desenvolvedor .NET Pleno" --senioridade pleno --area dotnet --modelo remoto --status candidatada --obrigatorios 85 --desejaveis 60 --experiencia 90 --dominio 70 --logistica 100
```

O programa responde com o Match Score calculado:

```
2026-11-11-nome-da-empresa-desenvolvedor-net-pleno: Match Score 82% (alta aderência)
```

Na primeira vez, isso cria o arquivo `private/vagas.json`. É nele que ficam as suas vagas reais, e o Git ignora essa pasta. A partir daí os comandos passam a usar os seus dados em vez dos de exemplo.

Todas as opções do `adicionar` estão em [Comandos](comandos.md).

#### Candidatura com os campos da Gupy

Ao se candidatar pela Gupy, o currículo padrão é o do próprio perfil Gupy. Copie os três campos da vaga (**Descrição da vaga**, **Responsabilidades e atribuições** e **Requisitos e qualificações**) para o registro. Se for enviar outro currículo, use `--curriculo outro --nome-curriculo NOME`:

```bash
python -m gupy_tracker adicionar --empresa "Nome" --cargo "Cargo" --url "https://..." \
  --obrigatorios 85 --desejaveis 60 --experiencia 90 --dominio 70 --logistica 100 \
  --descricao @descricao.txt --responsabilidades @responsabilidades.txt --requisitos @requisitos.txt
```

Os textos podem ser digitados entre aspas ou lidos de um arquivo `.txt` com `@`. Os arquivos não são enviados a lugar nenhum e ficam no seu computador.

### 4. Atualize o status quando o processo andar

```bash
python -m gupy_tracker status nome-da-empresa entrevista
```

Basta um trecho do id da vaga (aqui, `nome-da-empresa`). Os status possíveis são: `analisada`, `descartada`, `candidatada`, `triagem`, `teste`, `entrevista`, `oferta`, `recusada` e `desistencia`.

### 5. Acompanhe o ranking e a conversão

```bash
python -m gupy_tracker ranking                        # ranking no terminal
python -m gupy_tracker ranking --planilha "Planilha de controle.xlsx"  # ranking e preenche a planilha de controle
python -m gupy_tracker metricas                       # funil e taxa de conversão
python -m gupy_tracker relatorio --saida RANKING.md   # relatório anônimo em Markdown
```

O `RANKING.md` gerado troca os nomes das empresas por "Empresa 01", "Empresa 02" etc., então pode ser publicado.

### 6. (Opcional) Ative a trava contra vazamentos

```bash
git config core.hooksPath scripts/hooks
```

Depois disso, todo `git commit` verifica se o nome de alguma empresa das suas vagas aparece nos arquivos e, se aparecer, o commit é bloqueado. Para rodar a verificação na mão: `python -m gupy_tracker verificar`.

#### Análise automática do currículo

Em vez de digitar as notas, o programa lê o currículo e a vaga e calcula tudo sozinho. Não usa API paga nem internet: é uma comparação por regras, com dicionário de tecnologias.

Salve o currículo como `.txt`, `.md`, `.docx` ou `.pdf` com texto selecionável (um PDF escaneado, feito de imagem, não tem texto para ler). Copie os campos da vaga para arquivos `.txt` e rode:

```bash
python -m gupy_tracker analisar --cv curriculo.txt --descricao @descricao.txt --responsabilidades @responsabilidades.txt --requisitos @requisitos.txt
```

No Windows, use `py -m gupy_tracker ...` no lugar de `python -m gupy_tracker`. Para gravar a vaga com a análise, acrescente `--salvar --empresa "Nome" --cargo "Cargo" --url "https://..."`.

A análise mostra os cinco critérios, o Match Score, as palavras-chave que o currículo comprova, as lacunas e avisos. Requisitos sem tecnologia reconhecível, ou sem anos de experiência informados, ficam com nota neutra (50) e aparecem no aviso. Confira sempre o resultado antes de gravar.

#### Interface web: análise automática e exclusão

A interface (pasta `web/`) roda sobre o serviço Python e o BFF. Para subir tudo no Windows, em três terminais, a partir da raiz do projeto:

```powershell
py -m pip install grpcio-tools
py scripts\gerar_proto.py
py -m gupy_tracker.servidor_grpc
```

No segundo terminal, suba o BFF em `server\` (`npm install` na primeira vez, depois `npm start`). No terceiro, suba a interface em `web\` (`npm install` e `npm run dev`).

- **Nova vaga:** envie o currículo (PDF com texto, DOCX, TXT ou MD) e cole a página da vaga. Clique em **Analisar currículo**. Os critérios, as palavras-chave e as lacunas são preenchidos e podem ser ajustados antes de salvar.
- **Ranking:** cada linha tem **Excluir**. A exclusão só acontece depois de **Confirmar exclusão**. No modo anônimo, a exclusão usa o id mascarado da listagem, sem mostrar a empresa.

### Onde ficam os dados

Por padrão, em `private/vagas.json`. Para guardar em outro lugar (uma pasta sincronizada, por exemplo), passe `--dados caminho/vagas.json` antes do comando ou defina a variável de ambiente `GUPY_TRACKER_DADOS`.
