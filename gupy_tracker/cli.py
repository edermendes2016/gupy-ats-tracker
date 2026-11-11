"""Linha de comando: python -m gupy_tracker <comando>."""
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

from . import armazenamento, relatorio, vazamento
from .modelo import (AREAS, CORTE_VIABILIDADE, PESOS, SENIORIDADES, STATUS,
                     calcular_match_score, classificar, validar_vaga)


def _slug(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")


def _achar(vagas: list[dict], id_vaga: str) -> dict:
    candidatas = [v for v in vagas if v["id"] == id_vaga] or [v for v in vagas if id_vaga in v["id"]]
    if len(candidatas) != 1:
        motivo = "não encontrada" if not candidatas else "ambígua: " + ", ".join(v["id"] for v in candidatas)
        raise SystemExit(f"vaga '{id_vaga}' {motivo}")
    return candidatas[0]


def cmd_adicionar(args, caminho: Path) -> int:
    vagas = armazenamento.carregar(caminho)
    criterios = {nome: getattr(args, nome) for nome in PESOS}
    vaga = {
        "id": f"{args.data}-{_slug(args.empresa)}-{_slug(args.cargo)}",
        "data": args.data,
        "empresa": args.empresa,
        "cargo": args.cargo,
        "senioridade": args.senioridade,
        "area": args.area,
        "modelo": args.modelo,
        "url": args.url,
        "status": args.status,
        "criterios": criterios,
        "palavras_chave": args.palavra_chave or [],
        "lacunas": args.lacuna or [],
        "historico": [{"data": args.data, "status": args.status}],
    }
    vaga = {k: v for k, v in vaga.items() if v not in (None, "")}
    erros = validar_vaga(vaga)
    if erros:
        raise SystemExit("vaga inválida: " + "; ".join(erros))
    if any(v["id"] == vaga["id"] for v in vagas):
        raise SystemExit(f"já existe uma vaga com id {vaga['id']}")
    vagas.append(vaga)
    armazenamento.salvar(caminho, vagas)
    score = calcular_match_score(criterios)
    print(f"{vaga['id']}: Match Score {score}% ({classificar(score)})")
    if score < CORTE_VIABILIDADE:
        print(f"Abaixo do corte de {CORTE_VIABILIDADE}%: não vale o esforço.")
    return 0


def cmd_status(args, caminho: Path) -> int:
    vagas = armazenamento.carregar(caminho)
    vaga = _achar(vagas, args.id)
    vaga["status"] = args.novo_status
    vaga.setdefault("historico", []).append({"data": args.data, "status": args.novo_status})
    armazenamento.salvar(caminho, vagas)
    print(f"{vaga['id']}: {args.novo_status}")
    return 0


def cmd_ranking(args, caminho: Path) -> int:
    vagas = armazenamento.carregar(caminho)
    if args.anonimo:
        vagas = relatorio.anonimizar(vagas)
    print(relatorio.tabela_terminal(vagas))
    return 0


def cmd_metricas(args, caminho: Path) -> int:
    print(json.dumps(relatorio.metricas(armazenamento.carregar(caminho)), ensure_ascii=False, indent=2))
    return 0


def cmd_relatorio(args, caminho: Path) -> int:
    vagas = armazenamento.carregar(caminho)
    if not args.com_nomes:
        vagas = relatorio.anonimizar(vagas)
    texto = relatorio.markdown(vagas, titulo=args.titulo)
    if args.saida:
        Path(args.saida).write_text(texto, encoding="utf-8")
        print(f"relatório gravado em {args.saida}" + ("" if not args.com_nomes else " (COM nomes reais: não publique)"))
    else:
        print(texto)
    return 0


def cmd_verificar(args, caminho: Path) -> int:
    if caminho == armazenamento.EXEMPLO:
        print("sem dados privados para comparar (usando só os dados de exemplo): nada a verificar")
        return 0
    termos = vazamento.termos_privados(armazenamento.carregar(caminho), caminho.parent / "termos-privados.txt")
    achados = vazamento.procurar(termos, vazamento.arquivos_versionados(args.staged))
    for arquivo, linha, termo in achados:
        print(f"VAZAMENTO {arquivo.relative_to(armazenamento.RAIZ)}:{linha}: '{termo}'", file=sys.stderr)
    if achados:
        print(f"{len(achados)} ocorrência(s) de dados privados em arquivos versionáveis.", file=sys.stderr)
        return 1
    print(f"ok: nenhum dos {len(termos)} termos privados aparece em arquivos versionáveis")
    return 0


def criar_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="gupy_tracker", description="Registro e ranking de candidaturas na Gupy.")
    p.add_argument("--dados", help="arquivo vagas.json (padrão: GUPY_TRACKER_DADOS, private/vagas.json ou o exemplo)")
    sub = p.add_subparsers(dest="comando", required=True)
    hoje = date.today().isoformat()

    a = sub.add_parser("adicionar", help="registra uma vaga analisada")
    a.add_argument("--empresa", required=True)
    a.add_argument("--cargo", required=True)
    a.add_argument("--data", default=hoje)
    a.add_argument("--senioridade", choices=SENIORIDADES, default="nao_informada")
    a.add_argument("--area", choices=AREAS, default="outra")
    a.add_argument("--modelo", choices=["remoto", "hibrido", "presencial"])
    a.add_argument("--url")
    a.add_argument("--status", choices=STATUS, default="analisada")
    for nome, peso in PESOS.items():
        a.add_argument(f"--{nome}", type=int, required=True, metavar="0-100", help=f"peso {peso}%%")
    a.add_argument("--palavra-chave", action="append", help="palavra-chave da vaga presente no currículo (repetível)")
    a.add_argument("--lacuna", action="append", help="requisito da vaga que o currículo não cobre (repetível)")
    a.set_defaults(func=cmd_adicionar, escrita=True)

    s = sub.add_parser("status", help="atualiza o status de uma vaga")
    s.add_argument("id")
    s.add_argument("novo_status", choices=STATUS)
    s.add_argument("--data", default=hoje)
    s.set_defaults(func=cmd_status, escrita=True)

    r = sub.add_parser("ranking", help="mostra o ranking no terminal")
    r.add_argument("--anonimo", action="store_true")
    r.set_defaults(func=cmd_ranking)

    m = sub.add_parser("metricas", help="funil e taxa de conversão em JSON")
    m.set_defaults(func=cmd_metricas)

    rel = sub.add_parser("relatorio", help="gera o ranking em Markdown (anônimo por padrão)")
    rel.add_argument("--saida")
    rel.add_argument("--titulo", default="Ranking de vagas")
    rel.add_argument("--com-nomes", action="store_true", help="mantém os nomes reais (uso local, não publique)")
    rel.set_defaults(func=cmd_relatorio)

    v = sub.add_parser("verificar", help="procura nomes de empresas reais nos arquivos versionáveis")
    v.add_argument("--staged", action="store_true", help="verifica só o que está no stage (pre-commit)")
    v.set_defaults(func=cmd_verificar)
    return p


def main(argv: list[str] | None = None) -> int:
    args = criar_parser().parse_args(argv)
    try:
        return args.func(args, armazenamento.resolver_caminho(args.dados, getattr(args, "escrita", False)))
    except ValueError as e:
        raise SystemExit(f"erro: {e}")


if __name__ == "__main__":
    sys.exit(main())
