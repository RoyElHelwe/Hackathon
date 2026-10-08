#!/usr/bin/env bash
# Heroku web dyno: API on an internal port, Next.js on $PORT. If either exits, the dyno exits and Heroku restarts it.
set -euo pipefail
WEB_PORT="${PORT:-3000}"

trap 'kill 0' TERM INT

(cd /app/apps/api && PORT=4000 exec node --max-old-space-size=192 dist/main.js) &
(cd /app/apps/web && PORT="$WEB_PORT" exec node --max-old-space-size=224 node_modules/next/dist/bin/next start -p "$WEB_PORT" -H 0.0.0.0) &

wait -n
exit $?
