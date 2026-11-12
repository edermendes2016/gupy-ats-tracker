"""Ranking, métricas de conversão e relatório em Markdown."""
from __future__ import annotations

from collections import Counter

from .modelo import CHEGOU_ENTREVISTA, ENVIADAS, calcular_match_score, classificar


def ranquear(vagas: list[dict]) -> list[dict]:
    """Ordena por Match Score (maior primeiro); empate: candidatura mais recente."""
    com_score = [{**v, "match_score": calcular_match_score(v["criterios"])} for v in vagas]
    com_score.sort(key=lambda v: v["data"], reverse=True)
    com_score.sort(key=lambda v: v["match_score"], reverse=True)
    return com_score


def anonimizar(vagas: list[dict]) -> list[dict]:
    """Troca o nome da empresa por um apelido estável e remove campos que identificam a vaga.

    O apelido segue a ordem da primeira candidatura a cada empresa, então não muda
    quando o ranking muda.
    """
    apelidos: dict[str, str] = {}
    for v in sorted(vagas, key=lambda v: (v["data"], v["id"])):
        chave = v["empresa"].strip().casefold()
        if chave not in apelidos:
            apelidos[chave] = f"Empresa {len(apelidos) + 1:02d}"
    publicas = []
    for v in vagas:
        publica = {
            k: v[k]
            for k in ("data", "cargo", "senioridade", "area", "modelo", "status", "criterios")
            if k in v
        }
        publica["empresa"] = apelidos[v["empresa"].strip().casefold()]
        publica["id"] = publica["empresa"].lower().replace(" ", "-") + "-" + v["data"]
        publica["data"] = v["data"][:7]  # só ano-mês
        publicas.append(publica)
    return publicas


def _termo_base(item: str) -> str:
    """'Docker (só estudo ou certificação)' -> 'Docker'."""
    return item.split(" (")[0].strip()


def agregar_termos(vagas: list[dict], campo: str) -> list[dict]:
    """Conta em quantas vagas cada termo aparece (uma vez por vaga), do mais frequente ao menos."""
    contagem: Counter = Counter()
    for v in vagas:
        contagem.update({_termo_base(t) for t in v.get(campo, [])})
    ordenados = sorted(contagem.items(), key=lambda kv: (-kv[1], kv[0].casefold()))
    return [{"nome": nome, "vagas": n} for nome, n in ordenados]


def _primeira_data(vaga: dict, estados: set[str]) -> str | None:
    """Data da primeira vez que a vaga entrou em um dos estados (pelo histórico)."""
    for h in sorted(vaga.get("historico", []), key=lambda h: h["data"]):
        if h["status"] in estados:
            return h["data"]
    return None


def evolucao(vagas: list[dict]) -> list[dict]:
    """Por mês (AAAA-MM): vagas analisadas, candidaturas enviadas e entrevistas no mês."""
    meses: dict[str, dict] = {}

    def conta(mes: str, chave: str) -> None:
        meses.setdefault(mes, {"analisadas": 0, "enviadas": 0, "entrevistas": 0})[chave] += 1

    for v in vagas:
        conta(v["data"][:7], "analisadas")
        enviada = _primeira_data(v, ENVIADAS) if v["status"] in ENVIADAS else None
        if enviada:
            conta(enviada[:7], "enviadas")
        entrevista = _primeira_data(v, CHEGOU_ENTREVISTA) if v["status"] in CHEGOU_ENTREVISTA else None
        if entrevista:
            conta(entrevista[:7], "entrevistas")
    return [{"mes": mes, **meses[mes]} for mes in sorted(meses)]


def metricas(vagas: list[dict]) -> dict:
    enviadas = [v for v in vagas if v["status"] in ENVIADAS]
    entrevistas = [v for v in enviadas if v["status"] in CHEGOU_ENTREVISTA]
    scores = [calcular_match_score(v["criterios"]) for v in vagas]

    def taxa(parte, todo):
        return round(100 * len(parte) / len(todo)) if todo else 0

    faixas = {}
    for nome, minimo, maximo in (("40-59", 40, 59), ("60-79", 60, 79), ("80-100", 80, 100)):
        na_faixa = [v for v in enviadas if minimo <= calcular_match_score(v["criterios"]) <= maximo]
        faixas[nome] = {
            "enviadas": len(na_faixa),
            "entrevistas": len([v for v in na_faixa if v["status"] in CHEGOU_ENTREVISTA]),
        }
    return {
        "analisadas": len(vagas),
        "enviadas": len(enviadas),
        "entrevistas": len(entrevistas),
        "ofertas": len([v for v in vagas if v["status"] == "oferta"]),
        "conversao_entrevista": taxa(entrevistas, enviadas),
        "score_medio": round(sum(scores) / len(scores)) if scores else 0,
        "por_status": dict(Counter(v["status"] for v in vagas)),
        "por_faixa": faixas,
        "evolucao": evolucao(vagas),
        "pontos_fortes": agregar_termos(vagas, "palavras_chave"),
        "lacunas": agregar_termos(vagas, "lacunas"),
    }


def _celula(texto) -> str:
    return str(texto).replace("|", "\\|").replace("\n", " ")


def markdown(vagas: list[dict], titulo: str = "Ranking de vagas") -> str:
    ranking = ranquear(vagas)
    m = metricas(vagas)
    linhas = [
        f"# {titulo}",
        "",
        f"**{m['analisadas']}** vagas analisadas · **{m['enviadas']}** candidaturas · "
        f"**{m['entrevistas']}** entrevistas · conversão em entrevista **{m['conversao_entrevista']}%** · "
        f"Match Score médio **{m['score_medio']}%**",
        "",
        "| # | Match | Empresa | Cargo | Senioridade | Área | Status | Data |",
        "|--:|------:|---------|-------|-------------|------|--------|------|",
    ]
    for pos, v in enumerate(ranking, 1):
        linhas.append(
            f"| {pos} | {v['match_score']}% | {_celula(v['empresa'])} | {_celula(v['cargo'])} | "
            f"{v.get('senioridade', 'nao_informada')} | {v.get('area', 'outra')} | {v['status']} | {v['data']} |"
        )
    linhas += ["", "## Conversão por faixa de Match Score", "",
               "| Faixa | Candidaturas | Entrevistas |", "|-------|-------------:|------------:|"]
    for faixa, n in m["por_faixa"].items():
        linhas.append(f"| {faixa}% | {n['enviadas']} | {n['entrevistas']} |")
    linhas.append("")
    return "\n".join(linhas)


def tabela_terminal(vagas: list[dict]) -> str:
    ranking = ranquear(vagas)
    if not ranking:
        return "Nenhuma vaga registrada."
    linhas = [f"{'#':>2}  {'MATCH':>5}  {'STATUS':<12} {'EMPRESA':<24} CARGO"]
    for pos, v in enumerate(ranking, 1):
        linhas.append(
            f"{pos:>2}  {v['match_score']:>4}%  {v['status']:<12} {v['empresa'][:24]:<24} "
            f"{v['cargo']}  [{classificar(v['match_score'])}]"
        )
    return "\n".join(linhas)
