#!/bin/sh
# Sobe os dois processos: o serviço Python (gRPC, loopback) e o BFF (HTTP + interface).
# Se o BFF parar, o contêiner para; o gRPC é encerrado junto.
set -e

python -m gupy_tracker.servidor_grpc --endereco 127.0.0.1:50051 &
GRPC=$!

cd /app/server
node_modules/.bin/tsx src/main.ts &
BFF=$!

trap 'kill "$GRPC" "$BFF" 2>/dev/null' TERM INT
wait "$BFF"
STATUS=$?
kill "$GRPC" 2>/dev/null || true
exit "$STATUS"
