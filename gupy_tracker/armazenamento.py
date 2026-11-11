"""Leitura e gravação do arquivo de vagas (JSON)."""
from __future__ import annotations

import json
import os
from pathlib import Path

from .modelo import validar_vaga

RAIZ = Path(__file__).resolve().parent.parent
PADRAO_PRIVADO = RAIZ / "private" / "vagas.json"
EXEMPLO = RAIZ / "data" / "exemplo" / "vagas.json"


def resolver_caminho(argumento: str | None) -> Path:
    """--dados > GUPY_TRACKER_DADOS > private/vagas.json > dados de exemplo."""
    if argumento:
        return Path(argumento)
    env = os.environ.get("GUPY_TRACKER_DADOS")
    if env:
        return Path(env)
    return PADRAO_PRIVADO if PADRAO_PRIVADO.exists() else EXEMPLO


def carregar(caminho: Path) -> list[dict]:
    if not caminho.exists():
        return []
    vagas = json.loads(caminho.read_text(encoding="utf-8"))
    if not isinstance(vagas, list):
        raise ValueError(f"{caminho}: esperado uma lista de vagas")
    for vaga in vagas:
        erros = validar_vaga(vaga)
        if erros:
            raise ValueError(f"{caminho}: vaga {vaga.get('id', '?')}: {'; '.join(erros)}")
    return vagas


def salvar(caminho: Path, vagas: list[dict]) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(caminho.suffix + ".tmp")
    tmp.write_text(json.dumps(vagas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(caminho)
