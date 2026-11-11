# Proteção de dados

Três camadas impedem que algo sensível seja publicado:

1. **`.gitignore`**: `private/`, tudo em `data/` fora de `data/exemplo/`, currículos (`*.pdf`, `*.docx`), capturas de tela e arquivos de credenciais nunca são versionados.
2. **Relatório anônimo por padrão**: `relatorio` troca cada empresa por um apelido estável ("Empresa 01"), remove a URL e reduz a data a ano e mês. Nomes reais só saem com `--com-nomes`, para uso local.
3. **Verificação antes do commit**: `verificar` lê os nomes das empresas dos dados privados (e termos extras de `private/termos-privados.txt`, um por linha) e falha se algum aparecer em um arquivo versionável.

Para ativar a verificação em todo commit:

```bash
git config core.hooksPath scripts/hooks
```
