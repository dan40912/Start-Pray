#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[prod-migrate] DATABASE_URL is required" >&2
  exit 1
fi

echo "[prod-migrate] generating prisma client"
npx prisma generate

echo "[prod-migrate] running fail-closed preflight"
node scripts/db/preflight-prod-release.cjs

echo "[prod-migrate] applying migrations"
npx prisma migrate deploy

echo "[prod-migrate] migration status"
npx prisma migrate status

echo "[prod-migrate] exporting SQL bundle for audit"
node scripts/db/export-migration-bundle.cjs

echo "[prod-migrate] done"
