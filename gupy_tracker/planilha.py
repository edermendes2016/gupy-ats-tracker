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
import unicodedata
import zipfile
from datetime import date
from pathlib import Path
from xml.sax.saxutils import escape, unescape

COLUNAS = "ABCDEFGH"
PRIMEIRA_LINHA_DADOS = 3  # a linha 1 é o título e a 2 é o cabeçalho
ABA = "xl/worksheets/sheet1.xml"
TABELA = "xl/tables/table1.xml"
EPOCA_EXCEL = date(1899, 12, 30)
ESTILO_DATA = "10"  # formato de data do modelo (numFmt 14); sem ele a data vira número


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
    if coluna == "A" and isinstance(valor, int):
        estilo = ESTILO_DATA  # a coluna A é sempre data, mesmo em linha nova ou sem estilo
    s = f' s="{estilo}"' if estilo else ""
    if valor == "" or valor is None:
        return f'<c r="{ref}"{s}/>'
    if isinstance(valor, int):
        return f'<c r="{ref}"{s}><v>{valor}</v></c>'
    texto = escape(str(valor))
    return f'<c r="{ref}"{s} t="inlineStr"><is><t xml:space="preserve">{texto}</t></is></c>'


def _strings_compartilhadas(conteudo: dict[str, bytes]) -> list[str]:
    """Textos de xl/sharedStrings.xml. O Excel grava quase todo texto ali (t="s"), não na célula."""
    if "xl/sharedStrings.xml" not in conteudo:
        return []
    xml = conteudo["xl/sharedStrings.xml"].decode("utf-8")
    return [unescape("".join(re.findall(r"<t[^>]*>(.*?)</t>", si, re.S)))
            for si in re.findall(r"<si>(.*?)</si>", xml, re.S)]


def _chave(texto: str | None) -> str:
    """Empresa ou cargo para comparar: sem acento, sem diferença de caixa e de espaços."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", texto or "") if not unicodedata.combining(c))
    return " ".join(sem_acento.casefold().split())


def _linhas(xml: str, sst: list[str] = ()) -> dict[int, tuple[str, dict[str, str], dict[str, str]]]:
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
                if 't="s"' in c.group(2):
                    indice = re.search(r"<v>(\d+)</v>", c.group(3))
                    if indice and int(indice.group(1)) < len(sst):
                        textos[c.group(1)] = sst[int(indice.group(1))]
                else:
                    textos[c.group(1)] = unescape(re.sub(r"<[^>]+>", "", c.group(3)))
        linhas[n] = (m.group(2), estilos, textos)
    return linhas


def _textos_de(linha) -> dict[str, str]:
    return linha[2]


def _ja_existe(textos: dict[str, str], vaga: dict) -> bool:
    return (_chave(textos.get("B")) == _chave(vaga["empresa"])
            and _chave(textos.get("C")) == _chave(vaga["cargo"]))


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
        if _chave(str(atual)) != _chave(str(valor)):
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
    sst = _strings_compartilhadas(conteudo)
    linhas = _linhas(xml, sst)

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
                linhas = _linhas(xml, sst)
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


# Layout do modelo de controle (só formato: nenhum dado pessoal). Os estilos vêm de
# modelo_planilha/styles.xml e theme1.xml; o número é o índice de cada célula no estilo.
CABECALHO = [
    "Data de Inscrição", "Empresa", "Cargo", "Status",
    "Palavras-Chave da Vaga", "Lacuna (O que preciso aprender?)",
    "Fonte (LinkedIn/Gupy/ outros)", "Link da vaga",
]
LARGURAS = [22.140625, 18, 30.42578125, 18.85546875, 50.5703125, 36.7109375, 30.7109375, 118.28515625]
_ESTILO_LINHA = {"A": 10, "B": 1, "C": 1, "D": 1, "E": 1, "F": 1, "G": 1, "H": 2}
ESTILOS = {
    1: {"A": 17, "B": 16},
    2: {"A": 9, "B": 3, "C": 3, "D": 3, "E": 3, "F": 3, "G": 3, "H": 4},
    3: {"A": 10, "B": 1, "C": 1, "D": 15, "E": 14, "F": 1, "G": 1, "H": 7},
    4: {"A": 10, "B": 1, "C": 1, "D": 1, "E": 1, "F": 1, "G": 1, "H": 8},
    17: {"A": 12, "B": 5, "C": 5, "D": 5, "E": 5, "F": 5, "G": 5, "H": 6},
    **{n: dict(_ESTILO_LINHA) for n in range(5, 17)},
}
ULTIMA_LINHA_MODELO = 17
TABELA_MODELO = "Tabela1"
PASTA_MODELO = Path(__file__).resolve().parent / "modelo_planilha"


def gerar_modelo(caminho: Path) -> None:
    """Cria uma planilha de controle vazia, com o mesmo layout e formatação do modelo.

    Gera tudo por código, sem copiar a planilha de ninguém: estilos e tema são a
    formatação do modelo, sem nenhum dado.
    """
    from xml.sax.saxutils import escape as _esc
    if caminho.exists():
        raise FileExistsError(f"já existe um arquivo em {caminho}")

    def celula(col: str, n: int, estilo: int, texto: str | None = None) -> str:
        if texto is None:
            return f'<c r="{col}{n}" s="{estilo}"/>'
        return f'<c r="{col}{n}" s="{estilo}" t="inlineStr"><is><t xml:space="preserve">{_esc(texto)}</t></is></c>'

    linhas = []
    for n in range(1, ULTIMA_LINHA_MODELO + 1):
        estilos = ESTILOS.get(n, _ESTILO_LINHA)
        cels = []
        for col, estilo in estilos.items():  # só as células que o modelo tem em cada linha
            texto = CABECALHO[COLUNAS.index(col)] if n == 2 else None
            cels.append(celula(col, n, estilo, texto))
        linhas.append(f'<row r="{n}" spans="1:8">{"".join(cels)}</row>')
    colunas = "".join(
        f'<col min="{i + 1}" max="{i + 1}" width="{largura}" customWidth="1"/>' for i, largura in enumerate(LARGURAS)
    )
    aba = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        f'<dimension ref="A1:H{ULTIMA_LINHA_MODELO}"/>'
        '<sheetViews><sheetView tabSelected="1" workbookViewId="0"/></sheetViews>'
        '<sheetFormatPr defaultRowHeight="15"/>'
        f"<cols>{colunas}</cols>"
        f'<sheetData>{"".join(linhas)}</sheetData>'
        '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>'
        '<tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>'
    )
    colunas_tabela = "".join(
        f'<tableColumn id="{i + 1}" name="{_esc(nome)}"/>' for i, nome in enumerate(CABECALHO)
    )
    tabela = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="1" '
        f'name="{TABELA_MODELO}" displayName="{TABELA_MODELO}" ref="A2:H{ULTIMA_LINHA_MODELO}" totalsRowShown="0">'
        f'<autoFilter ref="A2:H{ULTIMA_LINHA_MODELO}"/>'
        f'<tableColumns count="{len(CABECALHO)}">{colunas_tabela}</tableColumns>'
        '<tableStyleInfo name="TableStyleMedium2" showFirstColumn="0" showLastColumn="0" '
        'showRowStripes="1" showColumnStripes="0"/></table>'
    )
    partes = {
        "[Content_Types].xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            '<Override PartName="/xl/tables/table1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>'
            '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
            '<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'
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
            '<sheets><sheet name="Planilha1" sheetId="1" r:id="rId1"/></sheets></workbook>'
        ),
        "xl/_rels/workbook.xml.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
            '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>'
            "</Relationships>"
        ),
        "xl/worksheets/_rels/sheet1.xml.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table1.xml"/>'
            "</Relationships>"
        ),
        "xl/worksheets/sheet1.xml": aba,
        "xl/tables/table1.xml": tabela,
        "xl/styles.xml": (PASTA_MODELO / "styles.xml").read_bytes(),
        "xl/theme/theme1.xml": (PASTA_MODELO / "theme1.xml").read_bytes(),
    }
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(caminho.suffix + ".tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for nome, conteudo in partes.items():
            z.writestr(nome, conteudo)
    tmp.replace(caminho)
