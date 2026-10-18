#!/usr/bin/env bash
# Run on the VPS from ~/clear-sys after copying new code (deploy/deploy.ps1 does both):
# installs, builds, restarts only CLEAR.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/sinadi-node/bin:$PATH"   # shared private Node 22

if [ ! -f .env.production ]; then
  echo "Missing ~/clear-sys/.env.production (see deploy/env.production.example)." >&2
  exit 1
fi

npm ci --no-audit --no-fund
npm run build
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

echo "CLEAR $(cat REVISION 2>/dev/null || echo '?') is running on 127.0.0.1:3040"
