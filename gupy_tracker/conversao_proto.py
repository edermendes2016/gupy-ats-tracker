"""Conversão entre o dicionário da vaga (JSON) e as mensagens Protobuf.

Requer o código gerado (scripts/gerar_proto.sh) e o extra grpc instalado.
O Match Score e a classificação são calculados aqui, no servidor.
"""
from __future__ import annotations

from datetime import date

from .modelo import calcular_match_score, classificar
from .v1 import vagas_pb2 as pb

# Campos de texto da Gupy: só saem no detalhe, nunca em listagens.
CAMPOS_DE_TEXTO = ("descricao", "responsabilidades", "requisitos")


def _enum(enum, prefixo: str, valor: str | None, padrao: str):
    return enum.Value(f"{prefixo}_{(valor or padrao).upper()}")


def _nome(enum, valor: int, prefixo: str) -> str | None:
    """Nome do enum sem o prefixo, em minúsculas. Desconhecido vira None."""
    nome = enum.Name(valor)
    if nome.endswith("DESCONHECIDO") or nome.endswith("NAO_INFORMADO") or nome.endswith("NAO_INFORMADA"):
        return None
    return nome[len(prefixo) + 1:].lower()


def status_do_proto(valor: int) -> str:
    """Enum de status (número do proto) -> texto do domínio, como 'entrevista'."""
    return pb.Status.Name(valor)[len("STATUS_"):].lower()


def vaga_para_proto(vaga: dict, *, detalhe: bool) -> pb.Vaga:
    criterios = vaga["criterios"]
    score = calcular_match_score(criterios)
    msg = pb.Vaga(
        id=vaga["id"],
        data=vaga["data"],
        empresa=vaga["empresa"],
        cargo=vaga["cargo"],
        senioridade=_enum(pb.Senioridade, "SENIORIDADE", vaga.get("senioridade"), "nao_informada"),
        area=vaga.get("area", "outra"),
        modelo=_enum(pb.Modelo, "MODELO", vaga.get("modelo"), "nao_informado"),
        url=vaga.get("url", ""),
        status=pb.Status.Value(f"STATUS_{vaga['status'].upper()}"),
        criterios=pb.Criterios(**{k: criterios[k] for k in pb.Criterios.DESCRIPTOR.fields_by_name}),
        match_score=score,
        classificacao=classificar(score),
        palavras_chave=vaga.get("palavras_chave", []),
        lacunas=vaga.get("lacunas", []),
        historico=[
            pb.Historico(data=h["data"], status=pb.Status.Value(f"STATUS_{h['status'].upper()}"))
            for h in vaga.get("historico", [])
        ],
    )
    if detalhe:
        for campo in CAMPOS_DE_TEXTO:
            if vaga.get(campo):
                setattr(msg, campo, vaga[campo])
    return msg


def requisicao_para_vaga(msg: pb.Vaga) -> dict:
    """Converte a mensagem recebida nos argumentos de casos_de_uso.registrar_vaga."""
    c = msg.criterios
    criterios = {nome: getattr(c, nome) for nome in pb.Criterios.DESCRIPTOR.fields_by_name}
    argumentos = {
        "data": msg.data or date.today().isoformat(),
        "empresa": msg.empresa,
        "cargo": msg.cargo,
        "criterios": criterios,
        "senioridade": _nome(pb.Senioridade, msg.senioridade, "SENIORIDADE") or "nao_informada",
        "area": msg.area or "outra",
        "modelo": _nome(pb.Modelo, msg.modelo, "MODELO"),
        "url": msg.url or None,
        "status": _nome(pb.Status, msg.status, "STATUS") or "analisada",
        "palavras_chave": list(msg.palavras_chave),
        "lacunas": list(msg.lacunas),
    }
    for campo in CAMPOS_DE_TEXTO:
        if msg.HasField(campo):
            argumentos[campo] = getattr(msg, campo)
    return argumentos
