#!/bin/sh
# Restaura um dump gerado por backup-db.sh. CUIDADO: sobrescreve o banco atual.
#
# Uso: ./scripts/restore-db.sh caminho/para/backup.sql.gz [nome-do-projeto-no-compose]

set -eu

DUMP_FILE="${1:?Informe o caminho do arquivo .sql.gz de backup}"
COMPOSE_PROJECT="${2:-}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -n "$COMPOSE_PROJECT" ]; then
  DB_CONTAINER=$(docker compose -p "$COMPOSE_PROJECT" -f "$PROJECT_DIR/docker-compose.prod.yml" ps -q db)
else
  DB_CONTAINER=$(docker compose -f "$PROJECT_DIR/docker-compose.prod.yml" ps -q db)
fi

if [ -z "$DB_CONTAINER" ]; then
  echo "Não encontrei o container do banco rodando." >&2
  exit 1
fi

echo "Isso vai APAGAR e recriar os dados atuais do banco a partir de $DUMP_FILE."
printf "Digite 'sim' para confirmar: "
read -r CONFIRM
if [ "$CONFIRM" != "sim" ]; then
  echo "Cancelado."
  exit 1
fi

gunzip -c "$DUMP_FILE" | docker exec -i "$DB_CONTAINER" sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
echo "Restauração concluída."
