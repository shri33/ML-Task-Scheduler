#!/bin/sh
set -e

if [ -d prisma/migrations ] && [ -n "$(find prisma/migrations -mindepth 1 -maxdepth 1 -type d 2>/dev/null)" ]; then
  echo "[entrypoint] Running Prisma migrations..."
  npx --no-install prisma migrate deploy
else
  echo "[entrypoint] No migration files found; syncing Prisma schema..."
  npx --no-install prisma db push
fi

echo "[entrypoint] Database ready. Starting application..."
exec node dist/index.js
