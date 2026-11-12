"""Checagem heurística: o texto parece um currículo?

Evita calcular score de um arquivo qualquer (um roteiro, uma vaga colada no lugar do
currículo etc.). Regras determinísticas, sem API:

  sinais (cada um vale 1):
    contato   e-mail ou telefone no texto
    secoes    pelo menos 2 títulos típicos em linha própria (experiência, formação...)
    periodos  pelo menos 2 intervalos de datas (ex.: "Jun/2022 – atual", "2013–2019")
    volume    pelo menos 80 palavras

  3 ou mais sinais: passa.  2 sinais: passa com aviso.  0 ou 1: recusa.
"""
from __future__ import annotations

import re
import unicodedata

MINIMO_SINAIS = 3
ACEITAVEL_COM_AVISO = 2
MINIMO_PALAVRAS = 80
MINIMO_SECOES = 2
MINIMO_PERIODOS = 2

_SECOES = (
    r"resumo|objetivo|perfil profissional|experiencias?( profissional(is)?)?|"
    r"historico profissional|formacao( academica)?|educacao|habilidades|competencias|"
    r"skills|certificacoes?|idiomas|projetos|cursos"
)
_RE_TITULO = re.compile(r"\s*#*\s*(" + _SECOES + r")\s*:?\s*")
_RE_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(\.[\w-]+)+")
_RE_TELEFONE = re.compile(r"\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b")
_MES = r"(?:[a-z]{3,}\.?\s*/?\s*|\d{1,2}\s*/\s*)?"
_ANO = r"(?:19|20)\d{2}"
_RE_PERIODO = re.compile(
    _MES + _ANO + r"\s*(?:-|–|—|a|até)\s*(?:atual|atualmente|presente|" + _MES + _ANO + r")"
)
_RE_PALAVRA = re.compile(r"[^\W\d_]{2,}")


class CurriculoNaoReconhecido(ValueError):
    """O texto enviado não tem cara de currículo."""


def _normalizar(texto: str) -> str:
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c))
    return sem_acento.casefold()


def _sinais(texto: str) -> dict[str, bool]:
    norm = _normalizar(texto)
    secoes = {m.group(1) for linha in norm.splitlines() if (m := _RE_TITULO.fullmatch(linha))}
    return {
        "contato": bool(_RE_EMAIL.search(norm) or _RE_TELEFONE.search(norm)),
        "secoes": len(secoes) >= MINIMO_SECOES,
        "periodos": len(_RE_PERIODO.findall(norm)) >= MINIMO_PERIODOS,
        "volume": len(_RE_PALAVRA.findall(norm)) >= MINIMO_PALAVRAS,
    }


_ROTULOS_FALTANTES = {
    "contato": "e-mail ou telefone",
    "secoes": "seções como experiência e formação",
    "periodos": "períodos de trabalho ou de estudo",
    "volume": "texto suficiente",
}


def verificar(curriculo: str) -> list[str]:
    """Devolve avisos (vazio se tudo certo). Lança CurriculoNaoReconhecido se não parece currículo."""
    sinais = _sinais(curriculo)
    passou = sum(sinais.values())
    if passou >= MINIMO_SINAIS:
        return []
    faltando = ", ".join(_ROTULOS_FALTANTES[k] for k, ok in sinais.items() if not ok)
    if passou == ACEITAVEL_COM_AVISO:
        return [f"o arquivo tem poucos sinais de currículo (faltam: {faltando}); confira se é o arquivo certo"]
    raise CurriculoNaoReconhecido(
        "este arquivo não parece um currículo (não encontrei "
        + faltando
        + "). Envie o currículo em PDF com texto, DOCX, TXT ou MD."
    )
