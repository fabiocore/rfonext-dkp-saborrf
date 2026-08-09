#!/usr/bin/env bash
# Redeploy de rotina de um ambiente ja existente no Dokploy (dispara o
# build/deploy do commit atual do branch configurado no compose app),
# espera concluir, e so entao move a tag git deployed/<tag> pro commit
# atual - registro de qual commit esta ao vivo em cada ambiente (dev/prod).
# Ver DEPLOY.md secao 8.5.
#
# Diferente de dokploy-deploy.sh (que provisiona um ambiente do zero), este
# script roda direto no host (so precisa de curl + git) e assume que o app
# Compose ja existe.
#
# Uso:
#   export DOKPLOY_URL=https://SEU-PAINEL-DOKPLOY
#   export DOKPLOY_API_KEY=xxxxxxxxxxxxxxxx
#   ./scripts/dokploy-redeploy.sh --compose-id <id> --tag dev
set -euo pipefail

if [ -z "${DOKPLOY_URL:-}" ] || [ -z "${DOKPLOY_API_KEY:-}" ]; then
  echo "Defina DOKPLOY_URL e DOKPLOY_API_KEY no ambiente antes de rodar." >&2
  exit 1
fi

COMPOSE_ID=""
TAG_NAME=""
while [ $# -gt 0 ]; do
  case "$1" in
    --compose-id) COMPOSE_ID="$2"; shift 2 ;;
    --tag) TAG_NAME="$2"; shift 2 ;;
    *) echo "Argumento desconhecido: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$COMPOSE_ID" ] || [ -z "$TAG_NAME" ]; then
  echo "Uso: $0 --compose-id <id> --tag <dev|prod>" >&2
  exit 1
fi

echo "Disparando deploy do compose $COMPOSE_ID..."
RESPONSE=$(curl -sf -X POST "$DOKPLOY_URL/api/compose.deploy" \
  -H "x-api-key: $DOKPLOY_API_KEY" -H "Content-Type: application/json" \
  -d "{\"composeId\":\"$COMPOSE_ID\"}")
echo "$RESPONSE" | grep -q '"success":true' || {
  echo "Falha ao disparar o deploy: $RESPONSE" >&2
  exit 1
}

echo "Aguardando conclusao..."
STATUS=""
for i in $(seq 1 30); do
  STATUS=$(curl -sf "$DOKPLOY_URL/api/compose.one?composeId=$COMPOSE_ID" -H "x-api-key: $DOKPLOY_API_KEY" \
    | grep -o '"composeStatus":"[^"]*"' | cut -d'"' -f4)
  echo "  tentativa $i: $STATUS"
  if [ "$STATUS" = "done" ] || [ "$STATUS" = "error" ]; then
    break
  fi
  sleep 10
done

if [ "$STATUS" != "done" ]; then
  echo "Deploy nao concluiu com sucesso (ultimo status: $STATUS) - tag deployed/$TAG_NAME NAO foi movida." >&2
  exit 1
fi

SHA=$(git rev-parse HEAD)
echo "Deploy concluido em $SHA. Movendo tag deployed/$TAG_NAME..."
git tag -f -a "deployed/$TAG_NAME" -m "Deploy $TAG_NAME em $(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SHA"
git push origin "deployed/$TAG_NAME" --force

echo "OK: deployed/$TAG_NAME -> $SHA"
