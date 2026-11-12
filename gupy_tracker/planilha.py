"""Preenche a planilha de controle (.xlsx) sem dependências externas.

Lê e grava o XML da primeira aba direto no zip do .xlsx. Linhas que já têm
empresa e cargo iguais aos de uma vaga não são duplicadas. Formatação, tabela
e cabeçalho da planilha são preservados.

Colunas (A a H), na ordem do modelo:
  Data de Inscrição | Empresa | Cargo | Status | Palavras-Chave da Vaga |
  Lacuna | Fonte | Link da vaga
"""
from __future__ import annotations

import re
import zipfile
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape

COLUNAS = "ABCDEFGH"
PRIMEIRA_LINHA_DADOS = 3  # a linha 1 é o título e a 2 é o cabeçalho
ABA = "xl/worksheets/sheet1.xml"
TABELA = "xl/tables/table1.xml"
EPOCA_EXCEL = date(1899, 12, 30)


def _serial(data_iso: str) -> int:
    return (date.fromisoformat(data_iso) - EPOCA_EXCEL).days


def valores_da_vaga(vaga: dict) -> list:
    """Valores das colunas A a G para uma vaga (o link vai na coluna H)."""
    fonte = vaga.get("fonte") or ("Gupy" if "gupy" in (vaga.get("url") or "").lower() else "Outros")
    return [
        _serial(vaga["data"]),
        vaga["empresa"],
        vaga["cargo"],
        vaga["status"],
        ", ".join(vaga.get("palavras_chave", [])),
        ", ".join(vaga.get("lacunas", [])),
        fonte,
        vaga.get("url", ""),
    ]


def _celula(coluna: str, linha: int, valor, estilo: str | None) -> str:
    ref = f"{coluna}{linha}"
    s = f' s="{estilo}"' if estilo else ""
    if valor == "" or valor is None:
        return f'<c r="{ref}"{s}/>'
    if isinstance(valor, int):
        return f'<c r="{ref}"{s}><v>{valor}</v></c>'
    texto = escape(str(valor))
    return f'<c r="{ref}"{s} t="inlineStr"><is><t xml:space="preserve">{texto}</t></is></c>'


def _linhas(xml: str) -> dict[int, tuple[str, dict[str, str], dict[str, str]]]:
    """Mapa linha -> (abertura da <row>, estilo por coluna, texto por coluna)."""
    linhas = {}
    for m in re.finditer(r'<row r="(\d+)"([^>]*?)(?:/>|>(.*?)</row>)', xml, re.S):
        n = int(m.group(1))
        estilos, textos = {}, {}
        for c in re.finditer(r'<c r="([A-Z]+)\d+"([^>]*?)(?:/>|>(.*?)</c>)', m.group(3) or "", re.S):
            sm = re.search(r'\ss="(\d+)"', c.group(2))
            if sm:
                estilos[c.group(1)] = sm.group(1)
            if c.group(3):
                textos[c.group(1)] = re.sub(r"<[^>]+>", "", c.group(3))
        linhas[n] = (m.group(2), estilos, textos)
    return linhas


def _textos_de(linha) -> dict[str, str]:
    return linha[2]


def _ja_existe(textos: dict[str, str], vaga: dict) -> bool:
    return (textos.get("B", "").strip().casefold() == vaga["empresa"].strip().casefold()
            and textos.get("C", "").strip().casefold() == vaga["cargo"].strip().casefold())


def _linha_de(vaga: dict, n: int, linhas: dict, xml_estilos: dict) -> str:
    valores = valores_da_vaga(vaga)
    celulas = "".join(_celula(col, n, valor, xml_estilos.get(col)) for col, valor in zip(COLUNAS, valores))
    return celulas


def _atualizar_linha(xml: str, n: int, vaga: dict, textos: dict, estilos: dict) -> tuple[str, bool]:
    """Preenche as colunas da linha que já existe com os valores da vaga (sem duplicar).

    Só mexe em colunas que estão vazias ou diferentes: data, empresa e cargo ficam como estão.
    Devolve (xml novo, se algo mudou).
    """
    valores = valores_da_vaga(vaga)
    colunas_novas = {}
    for col, valor in zip(COLUNAS, valores):
        if col in "ABC":
            continue
        if valor in ("", None):
            continue
        atual = textos.get(col, "")
        if str(atual).strip() != str(valor).strip():
            colunas_novas[col] = valor
    if not colunas_novas:
        return xml, False
    m = re.search(r'<row r="%d"([^>]*?)(?:/>|>(.*?)</row>)' % n, xml, re.S)
    atuais = {c.group(1): c.group(0) for c in re.finditer(r'<c r="([A-Z]+)\d+"[^>]*?(?:/>|>.*?</c>)', m.group(2) or "", re.S)}
    for col, valor in colunas_novas.items():
        atuais[col] = _celula(col, n, valor, estilos.get(col))
    corpo = "".join(atuais[c] for c in COLUNAS if c in atuais)
    nova = f'<row r="{n}"{m.group(1)}>{corpo}</row>'
    return xml[:m.start()] + nova + xml[m.end():], True


def exportar(caminho: Path, vagas: list[dict]) -> tuple[int, int]:
    """Acrescenta uma linha por vaga nova e completa as colunas de linhas já existentes.

    Devolve (adicionadas, já_existiam). Uma vaga já na planilha (mesma empresa e cargo)
    não ganha linha nova, mas suas colunas vazias (palavras-chave, lacunas, link...) são
    preenchidas com os dados atuais da vaga.
    """
    with zipfile.ZipFile(caminho) as z:
        conteudo = {nome: z.read(nome) for nome in z.namelist()}
        infos = {i.filename: i for i in z.infolist()}
    xml = conteudo[ABA].decode("utf-8")
    linhas = _linhas(xml)

    ultima = max(linhas)
    existentes = {n: t for n, (_, _, t) in linhas.items() if n >= PRIMEIRA_LINHA_DADOS}
    livres = sorted(n for n in range(PRIMEIRA_LINHA_DADOS, ultima + 1)
                    if n not in existentes or not existentes[n].get("B"))
    adicionadas = ja_existiam = 0
    atualizadas_xml = False

    for vaga in vagas:
        achada = next((n for n, t in existentes.items() if _ja_existe(t, vaga)), None)
        if achada is not None:
            ja_existiam += 1
            xml, mudou = _atualizar_linha(xml, achada, vaga, existentes[achada], linhas[achada][1])
            if mudou:
                linhas = _linhas(xml)
                existentes[achada] = {**existentes[achada], **{k: v for k, v in _textos_de(linhas[achada]).items()}}
                atualizadas_xml = True
            continue
        if livres:
            n = livres.pop(0)
        else:
            ultima += 1
            n = ultima
        abertura, estilos, _ = linhas.get(n, (' spans="1:8"', {}, {}))
        if n not in linhas:
            # Linha nova: copia a formatação da última linha da planilha.
            modelo = linhas[max(linhas)]
            estilos = modelo[1]
        valores = valores_da_vaga(vaga)
        celulas = "".join(
            _celula(col, n, valor, estilos.get(col))
            for col, valor in zip(COLUNAS, valores + [""])
        )
        nova = f'<row r="{n}"{abertura}>{celulas}</row>'
        if n in linhas:
            xml = re.sub(r'<row r="%d"[^>]*?(?:/>|>.*?</row>)' % n, lambda _m: nova, xml, count=1, flags=re.S)
        else:
            xml = xml.replace("</sheetData>", nova + "</sheetData>", 1)
            linhas[n] = (abertura, estilos, {})
        existentes[n] = {"B": vaga["empresa"], "C": vaga["cargo"]}
        adicionadas += 1

    if adicionadas or atualizadas_xml:
        fim = max(linhas)
        xml = re.sub(r'<dimension ref="A1:H\d+"/>', f'<dimension ref="A1:H{fim}"/>', xml, count=1)
        conteudo[ABA] = xml.encode("utf-8")
        if TABELA in conteudo:
            tabela = conteudo[TABELA].decode("utf-8")
            tabela = re.sub(r'(ref="A\d+:H)\d+"', lambda m: f'{m.group(1)}{fim}"', tabela, count=1)
            tabela = re.sub(r'(<autoFilter ref="A\d+:H)\d+"', lambda m: f'{m.group(1)}{fim}"', tabela, count=1)
            conteudo[TABELA] = tabela.encode("utf-8")
        tmp = caminho.with_suffix(caminho.suffix + ".tmp")
        with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
            for nome, dados in conteudo.items():
                z.writestr(infos[nome] if nome in infos else nome, dados)
        tmp.replace(caminho)
    return adicionadas, ja_existiam


CABECALHO = ["Data de Inscrição", "Empresa", "Cargo", "Status", "Palavras-Chave da Vaga", "Lacuna", "Fonte", "Link da vaga"]


def gerar_modelo(caminho: Path) -> None:
    """Cria uma planilha de controle nova, vazia, com o mesmo layout de colunas do modelo.

    Não usa a planilha de ninguém: só o layout (título, cabeçalho e colunas A a H).
    Formatação visual (cores, bordas) não é copiada; ela vem do modelo original.
    """
    from xml.sax.saxutils import escape as _esc
    if caminho.exists():
        raise FileExistsError(f"já existe um arquivo em {caminho}")
    def linha(n: int, valores: list[str]) -> str:
        celulas = "".join(
            f'<c r="{COLUNAS[i]}{n}" t="inlineStr"><is><t xml:space="preserve">{_esc(v)}</t></is></c>'
            for i, v in enumerate(valores) if v
        )
        return f'<row r="{n}">{celulas}</row>'
    aba = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        '<dimension ref="A1:H2"/><cols>'
        + "".join(f'<col min="{i}" max="{i}" width="22" customWidth="1"/>' for i in range(1, 9))
        + "</cols><sheetData>"
        + linha(1, ["Controle de candidaturas Gupy"])
        + linha(2, CABECALHO)
        + "</sheetData></worksheet>"
    )
    partes = {
        "[Content_Types].xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            "</Types>"
        ),
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            "</Relationships>"
        ),
        "xl/workbook.xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            '<sheets><sheet name="Controle" sheetId="1" r:id="rId1"/></sheets></workbook>'
        ),
        "xl/_rels/workbook.xml.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            "</Relationships>"
        ),
        ABA: aba,
    }
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(caminho.suffix + ".tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for nome, conteudo in partes.items():
            z.writestr(nome, conteudo)
    tmp.replace(caminho)
