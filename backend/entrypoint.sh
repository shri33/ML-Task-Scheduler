#!/bin/sh
set -e

echo "[entrypoint] Running Prisma migrations..."
npx --no-install prisma migrate deploy

echo "[entrypoint] Migrations complete. Starting application..."
exec node dist/index.js
