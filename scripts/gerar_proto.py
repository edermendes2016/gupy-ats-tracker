"""Gera o código Python do contrato em proto/ (saída: gupy_tracker/v1/).

Funciona igual em Windows, macOS e Linux, porque usa o mesmo Python que está rodando este script.

Uso (a partir da raiz do repositório):
    python scripts/gerar_proto.py

Precisa de grpcio-tools:
    python -m pip install grpcio-tools
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PROTO = RAIZ / "proto"
SAIDA = RAIZ / "gupy_tracker" / "v1"


def main() -> int:
    try:
        import grpc_tools  # noqa: F401
    except ImportError:
        print("Falta o grpcio-tools. Rode: python -m pip install grpcio-tools", file=sys.stderr)
        return 1

    protos = sorted((PROTO / "gupy_tracker" / "v1").glob("*.proto"))
    cmd = [
        sys.executable, "-m", "grpc_tools.protoc",
        f"-I{PROTO}",
        f"--python_out={RAIZ}",
        f"--grpc_python_out={RAIZ}",
        *map(str, protos),
    ]
    resultado = subprocess.run(cmd)
    if resultado.returncode == 0:
        print(f"Código gerado em {SAIDA}")
    return resultado.returncode


if __name__ == "__main__":
    raise SystemExit(main())
