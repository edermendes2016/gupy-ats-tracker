"""Impede que nomes de empresas reais (ou outros termos privados) entrem em commits."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

from .armazenamento import RAIZ

# Nomes curtos demais geram falso positivo (ex.: empresa "TI").
TAMANHO_MINIMO = 4


def termos_privados(vagas: list[dict], extras: Path | None = None) -> set[str]:
    termos = {v["empresa"].strip() for v in vagas}
    for v in vagas:
        if v.get("url"):
            termos.add(v["url"].strip())
    if extras and extras.exists():
        for linha in extras.read_text(encoding="utf-8").splitlines():
            linha = linha.strip()
            if linha and not linha.startswith("#"):
                termos.add(linha)
    return {t for t in termos if len(t) >= TAMANHO_MINIMO}


def arquivos_versionados(somente_staged: bool = False) -> list[Path]:
    cmd = ["git", "diff", "--cached", "--name-only", "--diff-filter=ACMR"] if somente_staged \
        else ["git", "ls-files", "--cached", "--others", "--exclude-standard"]
    saida = subprocess.run(cmd, cwd=RAIZ, capture_output=True, text=True, check=True).stdout
    return [RAIZ / nome for nome in saida.splitlines() if nome]


def procurar(termos: set[str], arquivos: list[Path]) -> list[tuple[Path, int, str]]:
    """Devolve (arquivo, linha, termo) para cada ocorrência, sem diferenciar maiúsculas."""
    if not termos:
        return []
    padrao = re.compile(
        "|".join(rf"(?<!\w){re.escape(t)}(?!\w)" for t in sorted(termos, key=len, reverse=True)),
        re.IGNORECASE,
    )
    achados = []
    for arquivo in arquivos:
        try:
            texto = arquivo.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for numero, linha in enumerate(texto.splitlines(), 1):
            for m in padrao.finditer(linha):
                achados.append((arquivo, numero, m.group(0)))
    return achados
