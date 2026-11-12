"""Leitura do texto do currículo (TXT, Markdown, DOCX e PDF com camada de texto).

Só biblioteca padrão. PDF depende do utilitário `pdftotext` (poppler); sem ele,
ou se o PDF for uma imagem, a leitura falha com uma mensagem clara.
"""
from __future__ import annotations

import re
import shutil
import subprocess
import zipfile
from pathlib import Path
from xml.etree import ElementTree

_NS_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def texto_de_docx(caminho: Path) -> str:
    with zipfile.ZipFile(caminho) as pacote:
        xml = pacote.read("word/document.xml")
    raiz = ElementTree.fromstring(xml)
    paragrafos = []
    for p in raiz.iter(_NS_W + "p"):
        paragrafos.append("".join(t.text or "" for t in p.iter(_NS_W + "t")))
    return "\n".join(paragrafos)


def texto_de_pdf(caminho: Path) -> str:
    if shutil.which("pdftotext") is None:
        raise ValueError("para ler PDF é preciso o utilitário pdftotext (poppler); ou envie o currículo em .txt ou .docx")
    resultado = subprocess.run(["pdftotext", "-layout", str(caminho), "-"], capture_output=True, text=True, check=False)
    if resultado.returncode != 0:
        raise ValueError(f"não consegui ler o PDF: {resultado.stderr.strip() or 'erro desconhecido'}")
    return resultado.stdout


def ler_curriculo(caminho: Path) -> str:
    """Texto do currículo. Lança ValueError com motivo claro quando não der para ler."""
    if not caminho.exists():
        raise ValueError(f"arquivo não encontrado: {caminho}")
    sufixo = caminho.suffix.lower()
    if sufixo in (".txt", ".md"):
        texto = caminho.read_text(encoding="utf-8")
    elif sufixo == ".docx":
        texto = texto_de_docx(caminho)
    elif sufixo == ".pdf":
        texto = texto_de_pdf(caminho)
    else:
        raise ValueError("formato sem suporte: use .txt, .md, .docx ou .pdf")
    texto = re.sub(r"[ \t]+\n", "\n", texto).strip()
    if not texto:
        raise ValueError("não encontrei texto no arquivo (PDF escaneado ou imagem?). Envie em .txt ou .docx")
    return texto
