#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/home/startpraynow/prayer-coin}"
BRANCH="${BRANCH:-main}"
REMOTE="${REMOTE:-origin}"
PM2_APP_NAME="${PM2_APP_NAME:-prayer-coin}"

cd "$APP_DIR"

echo "==> Deploying $REMOTE/$BRANCH in $APP_DIR"
echo "==> Current user: $(id -un)"

mkdir -p logs

echo "==> Pulling latest code"
git fetch "$REMOTE" "$BRANCH"
git pull --ff-only "$REMOTE" "$BRANCH"

echo "==> Installing dependencies with npm install"
npm install --include=dev --no-audit --fund=false

echo "==> Running fail-closed database preflight"
npm run db:preflight:prod

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Generating Prisma client"
npx prisma generate

echo "==> Rebuilding Next.js"
rm -rf .next
npm run build

echo "==> Restarting PM2"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME" --update-env
else
  pm2 start ecosystem.config.js
fi

pm2 save
pm2 status "$PM2_APP_NAME"
pm2 logs "$PM2_APP_NAME" --lines 30 --nostream

echo "==> Deployed commit: $(git rev-parse --short HEAD)"
