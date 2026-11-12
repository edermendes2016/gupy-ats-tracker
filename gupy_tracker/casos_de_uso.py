"""Casos de uso: regras de aplicação sobre a lista de vagas.

Não lê argumentos de linha de comando nem imprime nada. Quem chama (a CLI hoje,
um servidor gRPC na Etapa 3) traduz a entrada e decide como mostrar o resultado.
"""
from __future__ import annotations

import re
import unicodedata

from .modelo import CORTE_VIABILIDADE, calcular_match_score, classificar, validar_vaga


class VagaInvalida(ValueError):
    """Dados de uma vaga que não passam na validação do domínio."""


class CurriculoSemNome(VagaInvalida):
    """Currículo 'outro' informado sem o nome do arquivo."""


class VagaDuplicada(ValueError):
    """Já existe uma vaga com o mesmo id."""


class VagaNaoEncontrada(LookupError):
    """Nenhuma vaga, ou mais de uma, corresponde ao identificador informado."""


def slug(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", sem_acento.lower()).strip("-")


def achar_vaga(vagas: list[dict], id_vaga: str) -> dict:
    """Busca por id exato; se não houver, por trecho do id. Exige resultado único."""
    candidatas = [v for v in vagas if v["id"] == id_vaga] or [v for v in vagas if id_vaga in v["id"]]
    if len(candidatas) != 1:
        motivo = "não encontrada" if not candidatas else "ambígua: " + ", ".join(v["id"] for v in candidatas)
        raise VagaNaoEncontrada(f"vaga '{id_vaga}' {motivo}")
    return candidatas[0]


def registrar_vaga(
    vagas: list[dict],
    *,
    data: str,
    empresa: str,
    cargo: str,
    criterios: dict,
    senioridade: str = "nao_informada",
    area: str = "outra",
    modelo: str | None = None,
    url: str | None = None,
    status: str = "analisada",
    palavras_chave: list[str] | None = None,
    lacunas: list[str] | None = None,
    fonte: str = "Gupy",
    curriculo: str = "perfil-gupy",
    nome_curriculo: str | None = None,
    descricao: str | None = None,
    responsabilidades: str | None = None,
    requisitos: str | None = None,
) -> dict:
    """Valida, acrescenta a vaga à lista e devolve a vaga criada.

    Não grava em disco: quem chama decide quando salvar.
    """
    if curriculo == "outro" and not nome_curriculo:
        raise CurriculoSemNome("currículo 'outro' sem nome_curriculo")
    vaga = {
        "id": f"{data}-{slug(empresa)}-{slug(cargo)}",
        "data": data,
        "empresa": empresa,
        "cargo": cargo,
        "senioridade": senioridade,
        "area": area,
        "modelo": modelo,
        "url": url,
        "status": status,
        "criterios": criterios,
        "palavras_chave": palavras_chave or [],
        "lacunas": lacunas or [],
        "fonte": fonte,
        "curriculo": curriculo,
        "nome_curriculo": nome_curriculo,
        "descricao": descricao,
        "responsabilidades": responsabilidades,
        "requisitos": requisitos,
        "historico": [{"data": data, "status": status}],
    }
    vaga = {k: v for k, v in vaga.items() if v not in (None, "")}
    erros = validar_vaga(vaga)
    if erros:
        raise VagaInvalida("; ".join(erros))
    if any(v["id"] == vaga["id"] for v in vagas):
        raise VagaDuplicada(f"já existe uma vaga com id {vaga['id']}")
    vagas.append(vaga)
    return vaga


def atualizar_status(vagas: list[dict], id_vaga: str, novo_status: str, data: str) -> dict:
    """Muda o status da vaga e registra a mudança no histórico."""
    vaga = achar_vaga(vagas, id_vaga)
    vaga["status"] = novo_status
    vaga.setdefault("historico", []).append({"data": data, "status": novo_status})
    return vaga


def resumo_score(criterios: dict) -> tuple[int, str, bool]:
    """Match Score, classificação e se a vaga fica abaixo do corte de viabilidade."""
    score = calcular_match_score(criterios)
    return score, classificar(score), score < CORTE_VIABILIDADE
