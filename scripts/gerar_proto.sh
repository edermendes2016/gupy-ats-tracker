#!/usr/bin/env sh
# Gera o código Python a partir de proto/. Requer: pip install grpcio-tools
# Uso: [PYTHON=caminho/do/python] sh scripts/gerar_proto.sh [pasta_de_saida]
set -eu
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SAIDA="${1:-$RAIZ}"
mkdir -p "$SAIDA"
"${PYTHON:-python3}" -m grpc_tools.protoc -I"$RAIZ/proto" \
  --python_out="$SAIDA" --grpc_python_out="$SAIDA" \
  "$RAIZ"/proto/gupy_tracker/v1/*.proto
echo "código gerado em $SAIDA/gupy_tracker/v1"
