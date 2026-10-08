#!/usr/bin/env bash
# Heroku release phase: apply migrations on every deploy.
# The demo seed resets seeded data, so it only runs when SEED_ON_RELEASE=true
# (or manually: heroku run -a tajriba-school -- bash /app/scripts/heroku-release.sh --seed).
set -euo pipefail
cd /app/apps/api
npx prisma migrate deploy
if [ "${SEED_ON_RELEASE:-false}" = "true" ] || [ "${1:-}" = "--seed" ]; then
  npx ts-node --transpile-only prisma/seed.ts
fi
