#!/bin/sh
# Faz um dump do Postgres do compose de produção e salva em ./backups,
# compactado e com timestamp. Rode manualmente ou agende via cron do host
# (ver DEPLOY.md — "Backup do banco").
#
# Uso: ./scripts/backup-db.sh [nome-do-projeto-no-compose]
# Se você rodou `docker compose -p minha-guild -f docker-compose.prod.yml up -d`,
# passe "minha-guild" como argumento; senão ele tenta descobrir sozinho.

set -eu

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"
mkdir -p "$BACKUP_DIR"

COMPOSE_PROJECT="${1:-}"
if [ -n "$COMPOSE_PROJECT" ]; then
  DB_CONTAINER=$(docker compose -p "$COMPOSE_PROJECT" -f "$PROJECT_DIR/docker-compose.prod.yml" ps -q db)
else
  DB_CONTAINER=$(docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" ps -q db)
fi

if [ -z "$DB_CONTAINER" ]; then
  echo "Não encontrei o container do banco rodando. Confirme o nome do projeto do compose." >&2
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$BACKUP_DIR/rfonext_dkp_${TIMESTAMP}.sql.gz"

echo "Gerando dump em $OUT_FILE ..."
docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$OUT_FILE"

echo "Backup concluído: $OUT_FILE"

# Mantém só os últimos 14 backups pra não encher o disco.
ls -1t "$BACKUP_DIR"/rfonext_dkp_*.sql.gz 2>/dev/null | tail -n +15 | xargs -r rm --
