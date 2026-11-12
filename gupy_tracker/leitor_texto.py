"""Leitura do texto do currículo (TXT, Markdown, DOCX e PDF com camada de texto).

Só biblioteca padrão. PDF depende do utilitário `pdftotext` (poppler); sem ele,
ou se o PDF for uma imagem, a leitura falha com uma mensagem clara.
"""
from __future__ import annotations

import io
import re
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree

_NS_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def texto_de_docx(origem) -> str:
    """origem: caminho ou bytes de um .docx."""
    if isinstance(origem, (bytes, bytearray)):
        origem = io.BytesIO(origem)
    with zipfile.ZipFile(origem) as pacote:
        xml = pacote.read("word/document.xml")
    raiz = ElementTree.fromstring(xml)
    paragrafos = []
    for p in raiz.iter(_NS_W + "p"):
        paragrafos.append("".join(t.text or "" for t in p.iter(_NS_W + "t")))
    return "\n".join(paragrafos)


def texto_de_pdf(origem) -> str:
    """origem: caminho ou bytes de um PDF."""
    if shutil.which("pdftotext") is None:
        raise ValueError("para ler PDF é preciso o utilitário pdftotext (poppler); ou envie o currículo em .txt ou .docx")
    if isinstance(origem, (bytes, bytearray)):
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(origem)
            origem = Path(tmp.name)
        try:
            return texto_de_pdf(origem)
        finally:
            origem.unlink(missing_ok=True)
    resultado = subprocess.run(["pdftotext", "-layout", str(origem), "-"], capture_output=True, text=True, check=False)
    if resultado.returncode != 0:
        raise ValueError(f"não consegui ler o PDF: {resultado.stderr.strip() or 'erro desconhecido'}")
    return resultado.stdout


def ler_conteudo(nome: str, dados: bytes) -> str:
    """Texto de um currículo enviado como bytes; o nome do arquivo define o formato."""
    sufixo = Path(nome).suffix.lower()
    if sufixo in (".txt", ".md"):
        texto = dados.decode("utf-8", errors="replace")
    elif sufixo == ".docx":
        texto = texto_de_docx(dados)
    elif sufixo == ".pdf":
        texto = texto_de_pdf(dados)
    else:
        raise ValueError("formato sem suporte: use .txt, .md, .docx ou .pdf")
    return _limpar(texto)


def _limpar(texto: str) -> str:
    texto = re.sub(r"[ \t]+\n", "\n", texto).strip()
    if not texto:
        raise ValueError("não encontrei texto no arquivo (PDF escaneado ou imagem?). Envie em .txt ou .docx")
    return texto


def ler_curriculo(caminho: Path) -> str:
    """Texto do currículo a partir de um arquivo. Lança ValueError com motivo claro."""
    if not caminho.exists():
        raise ValueError(f"arquivo não encontrado: {caminho}")
    return ler_conteudo(caminho.name, caminho.read_bytes())
