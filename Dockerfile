# Imagem única: serviço Python gRPC + BFF (Node) + interface (React já compilada).
# O gRPC fica em 127.0.0.1 dentro do contêiner (o serviço só aceita loopback), e só o
# BFF é exposto, na porta 3000. Dados reais NÃO entram na imagem: entram por volume.

# 1) Interface: compila o React.
FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# 2) Dependências do BFF.
FROM node:22-slim AS bff
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci

# 3) Imagem final.
FROM python:3.12-slim
# pdftotext (poppler) é necessário para ler currículos em PDF.
RUN apt-get update \
    && apt-get install -y --no-install-recommends poppler-utils \
    && rm -rf /var/lib/apt/lists/*
# Node 22 vem da imagem oficial (mesma base Debian), para o BFF rodar sem npm no final.
COPY --from=bff /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1

# Só o que o serviço precisa (ver .dockerignore).
RUN pip install --no-cache-dir "grpcio>=1.60" "protobuf>=4.25" grpcio-tools
COPY proto/ ./proto/
COPY scripts/gerar_proto.py ./scripts/gerar_proto.py
COPY gupy_tracker/ ./gupy_tracker/
RUN python scripts/gerar_proto.py

COPY server/ ./server/
COPY --from=bff /app/server/node_modules ./server/node_modules
COPY --from=web /app/web/dist ./web/dist
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Dados e planilhas são montados por volume (ver docker-compose.yml).
RUN mkdir -p /app/private /app/planilhas
VOLUME ["/app/private", "/app/planilhas"]

ENV HOST=0.0.0.0 PORT=3000 WEB_DIST=/app/web/dist GRPC_ENDERECO=127.0.0.1:50051
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/saude').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
