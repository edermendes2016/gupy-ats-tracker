# Metodologia do Match Score

O Match Score estima a aderência do currículo a uma vaga **antes** da candidatura. Ele não tenta adivinhar o algoritmo da Gupy: é uma régua consistente para comparar vagas entre si e decidir onde investir tempo.

## Critérios

Cada critério recebe uma nota de 0 a 100. O score final é a média ponderada, arredondada.

| Critério | Peso | Como pontuar |
|----------|-----:|--------------|
| `obrigatorios` | 50% | Percentual dos requisitos obrigatórios que o currículo comprova com experiência real. Conhecimento apenas teórico ou de estudo conta pela metade. |
| `desejaveis` | 15% | Mesmo cálculo para os requisitos desejáveis e diferenciais. |
| `experiencia` | 15% | 100 se o tempo e o nível de experiência batem com o pedido; cai proporcionalmente conforme a distância (para mais ou para menos). |
| `dominio` | 10% | Proximidade com o setor e o tipo de sistema (por exemplo: setor público, sistemas corporativos, alta criticidade). |
| `logistica` | 10% | Modelo de trabalho, localidade, tipo de contratação e idioma exigido. |

## Faixas

| Score | Leitura | Ação |
|------:|---------|------|
| 0 a 39 | Não vale o esforço | Descartar |
| 40 a 59 | Aposta | Candidatar só se o custo for baixo |
| 60 a 79 | Boa aderência | Adaptar o currículo e candidatar |
| 80 a 100 | Alta aderência | Prioridade máxima |

## Regras

- **Nunca inventar.** Uma palavra-chave só entra no currículo adaptado se houver experiência, estudo ou certificação real por trás dela. O que falta vai para `lacunas`.
- **Palavras-chave visíveis.** A otimização para o ATS é feita espelhando os termos exatos da vaga no resumo, nas experiências e na seção de competências. Nada de texto oculto: é detectável e desclassifica.
- **Calibrar com o resultado.** A tabela "Conversão por faixa" do relatório mostra quantas candidaturas de cada faixa viraram entrevista. Se uma faixa não converte, o corte sobe.
