"""Modelo de dados e cálculo do Match Score."""
from __future__ import annotations

# Peso de cada critério no Match Score (somam 100).
PESOS = {
    "obrigatorios": 50,  # requisitos obrigatórios atendidos
    "desejaveis": 15,    # diferenciais / requisitos desejáveis
    "experiencia": 15,   # tempo e nível de experiência pedidos x reais
    "dominio": 10,       # setor, tipo de produto, contexto de negócio
    "logistica": 10,     # modelo de trabalho, localidade, contratação, idioma
}

# Abaixo disso a candidatura não compensa o esforço.
CORTE_VIABILIDADE = 40

# Funil, em ordem. Os três últimos são estados finais.
STATUS = [
    "analisada",
    "descartada",
    "candidatada",
    "triagem",
    "teste",
    "entrevista",
    "oferta",
    "recusada",
    "desistencia",
]

# Estados que contam como "chegou à entrevista" para a taxa de conversão.
CHEGOU_ENTREVISTA = {"entrevista", "oferta"}
# Estados que contam como candidatura enviada.
ENVIADAS = {"candidatada", "triagem", "teste", "entrevista", "oferta", "recusada", "desistencia"}

SENIORIDADES = ["junior", "pleno", "senior", "especialista", "nao_informada"]
AREAS = ["dotnet", "fullstack", "frontend", "cloud", "devops", "outra"]


def calcular_match_score(criterios: dict) -> int:
    """Média ponderada dos critérios (cada um de 0 a 100), arredondada."""
    faltando = [c for c in PESOS if c not in criterios]
    if faltando:
        raise ValueError(f"critérios ausentes: {', '.join(faltando)}")
    total = 0.0
    for nome, peso in PESOS.items():
        nota = criterios[nome]
        if isinstance(nota, bool) or not isinstance(nota, (int, float)) or not 0 <= nota <= 100:
            raise ValueError(f"critério '{nome}' deve ser um número de 0 a 100 (recebido: {nota!r})")
        total += nota * peso
    return round(total / 100)


def classificar(score: int) -> str:
    if score < CORTE_VIABILIDADE:
        return "não vale o esforço"
    if score < 60:
        return "aposta"
    if score < 80:
        return "boa aderência"
    return "alta aderência"


def validar_vaga(vaga: dict) -> list[str]:
    """Devolve a lista de problemas encontrados (vazia se a vaga é válida)."""
    erros = []
    for campo in ("id", "data", "empresa", "cargo", "status", "criterios"):
        if not vaga.get(campo):
            erros.append(f"campo obrigatório ausente: {campo}")
    if vaga.get("status") and vaga["status"] not in STATUS:
        erros.append(f"status inválido: {vaga['status']}")
    if vaga.get("senioridade", "nao_informada") not in SENIORIDADES:
        erros.append(f"senioridade inválida: {vaga['senioridade']}")
    if vaga.get("area", "outra") not in AREAS:
        erros.append(f"área inválida: {vaga['area']}")
    if vaga.get("criterios"):
        try:
            calcular_match_score(vaga["criterios"])
        except ValueError as e:
            erros.append(str(e))
    return erros
