"""Análise automática de aderência: compara o texto da vaga com o do currículo.

Só regras determinísticas (dicionário de tecnologias e de domínios, leitura de
anos de experiência e de períodos de trabalho). Não usa API paga, não faz
chamadas de rede e não grava nada: quem chama decide o que fazer com o resultado.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import date

from .modelo import calcular_match_score, classificar

# Nota usada quando não há como medir um critério. Sempre vem com um aviso.
NEUTRO = 50

# Tecnologias reconhecidas: nome exibido -> variações (sem acento, minúsculas).
TECNOLOGIAS: dict[str, list[str]] = {
    "C#": ["c#", "csharp"],
    ".NET": [".net", "dotnet"],
    "ASP.NET Core": ["asp.net core", "aspnet core", "asp.net"],
    "Entity Framework": ["entity framework", "ef core"],
    "SQL Server": ["sql server", "sqlserver", "mssql"],
    "Oracle": ["oracle"],
    "PostgreSQL": ["postgresql", "postgres"],
    "MySQL": ["mysql"],
    "Angular": ["angular"],
    "AngularJS": ["angularjs"],
    "TypeScript": ["typescript"],
    "JavaScript": ["javascript"],
    "React": ["react", "reactjs"],
    "Vue.js": ["vue.js", "vuejs"],
    "Node.js": ["node.js", "nodejs"],
    "Python": ["python"],
    "Java": ["java"],
    "Azure": ["azure"],
    "AWS": ["aws", "amazon web services"],
    "Docker": ["docker"],
    "Kubernetes": ["kubernetes", "k8s"],
    "Terraform": ["terraform"],
    "CI/CD": ["ci/cd", "cicd", "integracao continua", "entrega continua"],
    "Git": ["git"],
    "REST": ["rest", "restful", "api rest", "apis rest"],
    "Microsserviços": ["microsservicos", "microservicos", "microservices"],
    "Clean Architecture": ["clean architecture", "arquitetura limpa"],
    "DDD": ["ddd", "domain driven design"],
    "CQRS": ["cqrs"],
    "RabbitMQ": ["rabbitmq"],
    "Kafka": ["kafka"],
    "Design System": ["design system", "gov.br", "dsgov"],
    "Acessibilidade": ["acessibilidade", "wcag"],
    "Scrum": ["scrum"],
    "Swagger/OpenAPI": ["swagger", "openapi"],
    "JWT": ["jwt"],
    "Serilog": ["serilog"],
    "Observabilidade": ["observabilidade", "observability", "logs estruturados"],
    "Power BI": ["power bi", "powerbi"],
    "Testes automatizados": ["testes unitarios", "testes automatizados", "unit tests"],
    "Vitest": ["vitest"],
    "Jest": ["jest"],
    "Cypress": ["cypress"],
    "Linux": ["linux"],
    "Bootstrap": ["bootstrap"],
    "Tailwind CSS": ["tailwind"],
}

# Temas de domínio/setor reconhecidos.
DOMINIOS: dict[str, list[str]] = {
    "setor público": ["setor publico", "administracao publica", "governo", "orgao publico", "gov.br"],
    "sistemas corporativos": ["corporativo", "corporativos", "erp", "gestao empresarial"],
    "alta criticidade": ["sistemas criticos", "criticidade", "alta disponibilidade", "missao critica", "zero downtime"],
    "saúde": ["saude", "hospitalar"],
    "financeiro": ["financeiro", "bancario", "fintech", "pagamentos"],
    "educação": ["educacao", "edtech", "ensino"],
    "varejo e e-commerce": ["varejo", "e-commerce", "ecommerce"],
    "produto SaaS": ["saas"],
    "modernização de legado": ["legado", "modernizacao", "migracao"],
}

# Palavras que indicam estudo, certificação ou conhecimento só teórico (vale metade).
MARCAS_ESTUDO = ["conceitual", "conhecimento", "estudo", "estudando", "curso", "teorico", "credencial", "certific"]
# Palavras que marcam um requisito como desejável (diferencial).
MARCAS_DESEJAVEL = ["diferenci", "desejav", "desejad", "plus", "bonus", "nice to have"]
# Termos que indicam formação, não experiência profissional.
MARCAS_FORMACAO = ["uniderp", "universidade", "faculdade", "bacharel", "licenciatura", "formacao",
                   "concluido", "graduacao", "ufms"]
# Quantos caracteres antes e depois de uma tecnologia procurar marcas de estudo.
JANELA_ESTUDO = 40

MESES = {"jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
         "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12}

_RE_PERIODO = re.compile(
    r"(?:(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*/)?(\d{4})\s*[-–—]\s*"
    r"(?:(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*/)?(\d{4}|atual|presente|hoje)"
)


def norm(texto: str) -> str:
    """Minúsculas e sem acentos, para comparar termos."""
    sem_acento = "".join(c for c in unicodedata.normalize("NFKD", texto) if not unicodedata.combining(c))
    return sem_acento.lower()


def _padrao(alias: str) -> re.Pattern:
    # Não casa dentro de outra palavra: "java" não casa em "javascript".
    return re.compile(r"(?<![a-z0-9])" + re.escape(norm(alias)) + r"(?![a-z0-9])")


_TEC = {nome: [_padrao(a) for a in aliases] for nome, aliases in TECNOLOGIAS.items()}
_DOM = {nome: [_padrao(a) for a in aliases] for nome, aliases in DOMINIOS.items()}


def _linhas(texto: str) -> list[str]:
    limpas = (re.sub(r"^[\s\-•*·]+", "", linha).strip() for linha in texto.splitlines())
    return [linha for linha in limpas if linha]


def _tem_marca(texto_norm: str, marcas: list[str]) -> bool:
    return re.search(r"\b(?:" + "|".join(re.escape(m) for m in marcas) + r")", texto_norm) is not None


def tecnologias_em(texto: str) -> set[str]:
    t = norm(texto)
    return {nome for nome, ps in _TEC.items() if any(p.search(t) for p in ps)}


def dominios_em(texto: str) -> set[str]:
    t = norm(texto)
    return {nome for nome, ps in _DOM.items() if any(p.search(t) for p in ps)}


def cobertura_curriculo(curriculo: str) -> dict[str, float]:
    """Quanto o currículo comprova cada tecnologia.

    1.0 = aparece como experiência; 0.5 = aparece só perto de palavras de
    estudo ou certificação; ausente = não está no dicionário de cobertura.
    """
    cobertura: dict[str, float] = {}
    # A janela nunca cruza a quebra de linha: uma linha de estudo não contamina a seguinte.
    for linha in norm(curriculo).splitlines():
        for nome, ps in _TEC.items():
            for padrao in ps:
                for m in padrao.finditer(linha):
                    trecho = linha[max(0, m.start() - JANELA_ESTUDO): m.end() + JANELA_ESTUDO]
                    valor = 0.5 if _tem_marca(trecho, MARCAS_ESTUDO) else 1.0
                    cobertura[nome] = max(cobertura.get(nome, 0.0), valor)
    return cobertura


def separar_requisitos(texto: str) -> tuple[set[str], set[str]]:
    """Devolve (tecnologias obrigatórias, tecnologias desejáveis) do texto de requisitos."""
    obrigatorias: set[str] = set()
    desejaveis: set[str] = set()
    em_desejaveis = False
    for linha in _linhas(texto):
        l = norm(linha)
        cabecalho = len(l) <= 40
        if cabecalho and _tem_marca(l, MARCAS_DESEJAVEL):
            em_desejaveis = True
            continue
        if cabecalho and any(p in l for p in ("obrigatori", "requisito", "qualifica")):
            em_desejaveis = False
            continue
        tecnologias = tecnologias_em(linha)
        if em_desejaveis or _tem_marca(l, MARCAS_DESEJAVEL):
            desejaveis |= tecnologias
        else:
            obrigatorias |= tecnologias
    return obrigatorias, desejaveis - obrigatorias


def _nota_tecnologias(necessarias: set[str], cobertura: dict[str, float]) -> int | None:
    if not necessarias:
        return None
    return round(100 * sum(cobertura.get(t, 0.0) for t in necessarias) / len(necessarias))


def anos_pedidos(vaga: str) -> float | None:
    """Maior tempo de experiência pedido em uma linha que fala de experiência ('5+ anos')."""
    melhor = None
    for linha in _linhas(vaga):
        l = norm(linha)
        if "experien" not in l:
            continue
        for m in re.finditer(r"(\d{1,2})\s*(?:\+|ou mais)?\s*anos", l):
            n = int(m.group(1))
            melhor = n if melhor is None else max(melhor, n)
    return float(melhor) if melhor else None


def anos_curriculo(curriculo: str, hoje: date) -> float:
    """Anos de experiência do currículo: a maior de 'N anos de experiência' e a soma dos períodos
    de trabalho (sem repetir meses sobrepostos e ignorando linhas de formação)."""
    explicitos = [int(m.group(1)) for m in re.finditer(r"(\d{1,2})\s*\+?\s*anos de experien", norm(curriculo))]
    agora = hoje.year * 12 + hoje.month - 1
    intervalos = []
    for linha in _linhas(curriculo):
        l = norm(linha)
        if _tem_marca(l, MARCAS_FORMACAO):
            continue
        for m in _RE_PERIODO.finditer(l):
            mes_i, ano_i, mes_f, fim = m.group(1), m.group(2), m.group(3), m.group(4)
            inicio = int(ano_i) * 12 + (MESES[mes_i] - 1 if mes_i else 0)
            if fim in ("atual", "presente", "hoje"):
                final = agora
            else:
                final = int(fim) * 12 + (MESES[mes_f] - 1 if mes_f else 11)
            if final >= inicio:
                intervalos.append((inicio, final))
    meses = 0
    atual_ini = atual_fim = None
    for ini, fim in sorted(intervalos):
        if atual_fim is None or ini > atual_fim + 1:
            if atual_fim is not None:
                meses += atual_fim - atual_ini + 1
            atual_ini, atual_fim = ini, fim
        else:
            atual_fim = max(atual_fim, fim)
    if atual_fim is not None:
        meses += atual_fim - atual_ini + 1
    por_periodos = round(meses / 12, 1)
    return max([por_periodos, *explicitos])


def _nota_experiencia(vaga: str, curriculo: str, hoje: date) -> tuple[int | None, float, float | None]:
    pedido = anos_pedidos(vaga)
    tempo = anos_curriculo(curriculo, hoje)
    if not pedido:
        return None, tempo, pedido
    # Cai proporcionalmente conforme a distância, para mais ou para menos.
    return max(0, round(100 * (1 - abs(tempo - pedido) / pedido))), tempo, pedido


def _modelo_da_vaga(vaga: str) -> str | None:
    l = norm(vaga)
    for chave in ("remoto", "hibrido", "presencial"):
        if re.search(r"\b" + chave + r"\b", l):
            return chave
    return None


def _nota_logistica(vaga: str, curriculo: str, modelo: str | None) -> tuple[int, list[str]]:
    avisos: list[str] = []
    l = norm(vaga)
    modelo_conhecido = modelo or _modelo_da_vaga(vaga)
    if not modelo_conhecido and "ingles" not in l:
        # Nada na vaga sobre modelo nem idioma: não há como medir, então fica neutro.
        return NEUTRO, ["a vaga não informa modelo de trabalho nem idioma; logística neutra"]
    nota = 100
    if "ingles" in l:
        linhas_ingles = [norm(x) for x in _linhas(curriculo) if "ingles" in norm(x)]
        exige_alto = re.search(r"ingles[^\n]{0,40}(fluente|avancado)|(fluente|avancado)[^\n]{0,40}ingles", l)
        if not linhas_ingles:
            nota = min(nota, 60)
            avisos.append("a vaga cita inglês e o currículo não informa o nível")
        elif any(re.search(r"basico|inicial|novice|basic", x) for x in linhas_ingles):
            if exige_alto:
                nota = min(nota, 40)
                avisos.append("a vaga pede inglês fluente ou avançado e o currículo declara nível básico")
            else:
                nota = min(nota, 70)
    if modelo_conhecido == "presencial":
        nota -= 20
        avisos.append("vaga presencial: confirme se a localidade é compatível")
    return max(0, nota), avisos


DOMINIO_AVISO = "a vaga não tem temas de domínio reconhecidos; critério de domínio ficou neutro"


@dataclass
class Analise:
    criterios: dict[str, int]
    match_score: int
    classificacao: str
    palavras_chave: list[str]
    lacunas: list[str]
    avisos: list[str]
    sugestoes: list[str]
    anos_curriculo: float
    anos_pedidos: float | None


def analisar(
    *,
    curriculo: str,
    requisitos: str = "",
    descricao: str = "",
    responsabilidades: str = "",
    modelo: str | None = None,
    hoje: date | None = None,
) -> Analise:
    """Calcula os cinco critérios, o Match Score, as palavras-chave e as lacunas."""
    hoje = hoje or date.today()
    vaga = "\n".join(t for t in (descricao, responsabilidades, requisitos) if t and t.strip())
    if not vaga.strip():
        raise ValueError("informe a descrição ou os requisitos da vaga")
    if not curriculo.strip():
        raise ValueError("o currículo está vazio")

    avisos: list[str] = []
    cobertura = cobertura_curriculo(curriculo)
    obrigatorias, desejaveis = separar_requisitos(requisitos or vaga)

    def nota_ou_neutro(necessarias: set[str], nome: str) -> int:
        nota = _nota_tecnologias(necessarias, cobertura)
        if nota is None:
            avisos.append(f"nenhuma tecnologia reconhecida em {nome}; critério neutro ({NEUTRO})")
            return NEUTRO
        return nota

    criterios = {
        "obrigatorios": nota_ou_neutro(obrigatorias, "requisitos obrigatórios"),
        "desejaveis": nota_ou_neutro(desejaveis, "desejáveis"),
    }

    nota_exp, tempo, pedido = _nota_experiencia(vaga, curriculo, hoje)
    if nota_exp is None:
        criterios["experiencia"] = NEUTRO
        avisos.append("a vaga não diz quantos anos de experiência pede; critério neutro")
    else:
        criterios["experiencia"] = nota_exp

    dom_vaga = dominios_em(vaga)
    if dom_vaga:
        criterios["dominio"] = round(100 * len(dom_vaga & dominios_em(curriculo)) / len(dom_vaga))
    else:
        criterios["dominio"] = NEUTRO
        avisos.append(DOMINIO_AVISO)

    criterios["logistica"], avisos_log = _nota_logistica(vaga, curriculo, modelo)
    avisos.extend(avisos_log)

    tecnologias_vaga = tecnologias_em(vaga)
    palavras = [t for t in TECNOLOGIAS if t in tecnologias_vaga and cobertura.get(t, 0) > 0]
    lacunas = []
    for t in TECNOLOGIAS:
        if t in (obrigatorias | desejaveis) and cobertura.get(t, 0) < 1:
            lacunas.append(t + (" (só estudo ou certificação)" if cobertura.get(t, 0) else ""))

    sugestoes = []
    for t in TECNOLOGIAS:
        if t not in (obrigatorias | desejaveis):
            continue
        if cobertura.get(t, 0) == 0:
            sugestoes.append(f"{t} está na vaga e não aparece no currículo. Se você já usou, cite-o numa experiência real; se não, é um gap para estudar.")
        elif cobertura[t] < 1:
            sugestoes.append(f"{t} aparece só como estudo ou certificação. Se houve prática, descreva-a numa experiência.")
    if pedido and tempo < pedido:
        sugestoes.append(f"A vaga pede {pedido:g} anos e o currículo soma {tempo:g} anos pelos períodos. Confira se os períodos de cada experiência estão completos.")

    score = calcular_match_score(criterios)
    return Analise(
        criterios=criterios,
        match_score=score,
        classificacao=classificar(score),
        palavras_chave=palavras,
        lacunas=lacunas,
        avisos=avisos,
        sugestoes=sugestoes,
        anos_curriculo=tempo,
        anos_pedidos=pedido,
    )



