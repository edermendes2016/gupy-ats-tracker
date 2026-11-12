# Aviso legal: a extensão e a aba Aventura

A aba **Aventura** é um jogo idle sobre o seu processo seletivo. O XP vem do tempo que cada vaga passa em cada etapa e das etapas concluídas. Este texto explica o que a extensão faz, o que ela não faz e o risco que você assume ao usá-la.

## O que a extensão faz

- Roda **só** na página **Minhas candidaturas** (`portal.gupy.io/my/applications`), e só lê o texto dos cards quando você clica em **Ler e enviar para o tracker**.
- Lê apenas empresa, cargo e o contador "Seu Progresso X/Y" de cada card.
- Envia esses dados **para o tracker rodando no seu computador** (`127.0.0.1`). Nada vai para servidores da Gupy, do projeto ou de terceiros.
- Não guarda login, senha, cookies ou tokens. Não lê outras abas, e-mails ou dados pessoais além do que está escrito no card.

## O que a extensão não faz

- Não roda em segundo plano e não consulta a Gupy sozinha.
- Não envia candidaturas, não responde perguntas de processo seletivo e não altera nada no portal.
- Não é uma API oficial. A Gupy oferece uma API pública, voltada a empresas e integrações. Esta extensão não usa essa API.

## Risco dos termos da Gupy

Os [Termos de Uso do Gupy Recrutamento e Seleção para candidatos](https://www.gupy.io/termos-de-uso-recrutamento-e-selecao-candidatos) proíbem, entre outras coisas, copiar ou duplicar partes da plataforma, acessar dados ou contas sem autorização e interferir nos serviços. Eles também dizem que a Gupy disponibiliza apenas a API pública e webhooks para integrações.

Os termos não citam extensões nem leitura automática por nome, mas uma ferramenta que lê o portal pode ser vista como uma dessas práticas. Se isso acontecer, a Gupy pode **suspender ou cancelar a sua conta**. O risco é seu.

## Alternativa sem risco

Você pode registrar a etapa à mão, na aba **Aventura**, em "Registrar etapa à mão". O XP é o mesmo. Nada é lido no portal.

## Aviso

Este texto **não é parecer jurídico**. Ele descreve o funcionamento do projeto e os termos públicos da Gupy na data em que foi escrito. Se tiver dúvida sobre o uso permitido, consulte os termos atualizados ou um advogado.

## Dados

Os dados do progresso ficam em `private/progresso.json`, fora do Git. Nenhum dado pessoal entra no repositório.
