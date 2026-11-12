"""Respostas sugeridas para a etapa "Apresente-se!" da Gupy.

Duas perguntas:
  1. "A empresa deseja saber mais sobre você!" (até 1.500 caracteres)
  2. "Quais são as suas habilidades mais valiosas para esta vaga?" (até 3 habilidades)

Tudo sai de fatos que a análise já extraiu do currículo (cargo, anos, tecnologias).
Nada é inventado: uma tecnologia só aparece se estiver no currículo. Tecnologia pedida
pela vaga e ausente do currículo nunca é citada. Sem API, sem log do conteúdo.
"""
from __future__ import annotations

from dataclasses import dataclass, field

LIMITE_APRESENTACAO = 1500
MAX_HABILIDADES = 3
MAX_EXPERIENCIA_NA_FRASE = 5
MAX_ESTUDO_NA_FRASE = 4
MAX_OUTRAS_NA_FRASE = 4


@dataclass(frozen=True)
class RespostasGupy:
    apresentacao: str
    habilidades: list[str] = field(default_factory=list)


def _lista(itens: list[str]) -> str:
    if not itens:
        return ""
    if len(itens) == 1:
        return itens[0]
    return ", ".join(itens[:-1]) + " e " + itens[-1]


def _limitar(texto: str, limite: int = LIMITE_APRESENTACAO) -> str:
    """Corta no último ponto final que cabe no limite (nunca no meio de uma frase)."""
    if len(texto) <= limite:
        return texto
    corte = texto.rfind(".", 0, limite)
    return texto[: corte + 1] if corte > 0 else texto[:limite]


def montar(
    *,
    tecnologias_cv: dict[str, float],
    pesos_vaga: dict[str, int],
    cargo: str | None,
    anos: float,
) -> RespostasGupy:
    """Monta as duas respostas.

    tecnologias_cv: tecnologia -> cobertura no currículo (1.0 experiência, 0.5 só estudo).
    pesos_vaga: tecnologia -> peso na vaga (3 obrigatória, 2 desejável, 1 só citada).
    """
    ordem = sorted(
        tecnologias_cv,
        key=lambda t: (-tecnologias_cv[t], -pesos_vaga.get(t, 0), t.casefold()),
    )
    na_vaga = [t for t in ordem if t in pesos_vaga]
    # Habilidades: primeiro as de experiência que a vaga pede; depois as de estudo; depois outras do currículo.
    prioritarias = sorted(na_vaga, key=lambda t: (-tecnologias_cv[t], -pesos_vaga[t], t.casefold()))
    habilidades = prioritarias[:MAX_HABILIDADES]
    if len(habilidades) < MAX_HABILIDADES:
        habilidades += [t for t in ordem if t not in habilidades][: MAX_HABILIDADES - len(habilidades)]

    experiencia = [t for t in ordem if tecnologias_cv[t] >= 1]
    estudo = [t for t in ordem if tecnologias_cv[t] < 1]

    frases: list[str] = []
    n = int(anos)
    if cargo and n >= 1:
        frases.append(f"Sou {cargo.lower()} com {n} anos de experiência.")
    elif cargo:
        frases.append(f"Sou {cargo.lower()}.")
    elif n >= 1:
        frases.append(f"Tenho {n} anos de experiência profissional na área.")

    # Tecnologias de experiência que a vaga pede vêm antes das outras.
    usadas_na_vaga = [t for t in experiencia if t in pesos_vaga][:MAX_EXPERIENCIA_NA_FRASE]
    if usadas_na_vaga:
        frases.append(f"No dia a dia, trabalho com {_lista(usadas_na_vaga)}.")
    resto_experiencia = [t for t in experiencia if t not in usadas_na_vaga][:MAX_OUTRAS_NA_FRASE]
    if resto_experiencia:
        frases.append(f"Também tenho experiência com {_lista(resto_experiencia)}.")
    if estudo:
        frases.append(f"Tenho estudado {_lista(estudo[:MAX_ESTUDO_NA_FRASE])}.")

    frases.append("Gostaria de contribuir com a equipe e seguir aprendendo com os desafios do time.")
    return RespostasGupy(
        apresentacao=_limitar(" ".join(frases)),
        habilidades=habilidades,
    )
