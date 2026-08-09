#!/usr/bin/env bash
# Wrapper do dokploy-deploy.mjs - roda dentro de um container Node (este
# projeto nao depende de Node instalado no host, so Docker).
#
# Variaveis obrigatorias no ambiente: DOKPLOY_URL, DOKPLOY_API_KEY.
#
# IMPORTANTE: os arquivos passados em --ssh-private-key-file /
# --ssh-public-key-file precisam estar DENTRO deste repositorio (ex:
# ./.dokploy/keys/minhaguild), porque so a raiz do projeto e montada no
# container. Gere a chave com:
#   mkdir -p .dokploy/keys
#   ssh-keygen -t ed25519 -C "dokploy-deploy-minhaguild" -f .dokploy/keys/minhaguild_deploy_key -N ""
# (.dokploy/ ja esta no .gitignore - nunca commitar chave privada)
#
# Exemplo (ambiente dev de uma guild nova):
#   export DOKPLOY_URL=https://painel.exemplo.com
#   export DOKPLOY_API_KEY=xxxxx
#   ./scripts/dokploy-deploy.sh \
#     --guild minhaguild --env dev --domain minhaguild-dev.exemplo.com \
#     --repo git@github.com:usuario/minhaguild.git \
#     --ssh-key-name minhaguild-deploy-key \
#     --ssh-private-key-file .dokploy/keys/minhaguild_deploy_key \
#     --ssh-public-key-file .dokploy/keys/minhaguild_deploy_key.pub
set -euo pipefail

if [ -z "${DOKPLOY_URL:-}" ] || [ -z "${DOKPLOY_API_KEY:-}" ]; then
  echo "Defina DOKPLOY_URL e DOKPLOY_API_KEY no ambiente antes de rodar." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# MSYS_NO_PATHCONV evita o git-bash "corrigir" os paths tipo /work pra
# C:\...\work antes do Docker ver o argumento (só afeta Windows/Git Bash).
MSYS_NO_PATHCONV=1 docker run --rm -i \
  -e DOKPLOY_URL="$DOKPLOY_URL" \
  -e DOKPLOY_API_KEY="$DOKPLOY_API_KEY" \
  -v "$REPO_ROOT:/work" \
  -w /work \
  node:20-alpine \
  node scripts/dokploy-deploy.mjs "$@"
