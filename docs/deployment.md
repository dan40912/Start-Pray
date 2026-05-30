# Deployment Guide

This is a short deployment overview. See the root deployment runbooks for environment-specific notes.

## Build

```bash
npm install --include=dev --no-audit --fund=false
npx prisma migrate deploy
npx prisma generate
npm run build
```

## Start

```bash
npm run start
```

## Environment

Start Pray expects environment variables for:

- database connection
- session secrets
- media storage path
- public site URL
- email or reset-password settings, if enabled

Start from:

```text
.env.example
```

## Database Migrations

For production-like environments:

```bash
npx prisma migrate deploy
```

For local schema work:

```bash
npx prisma migrate dev
```

## Docker

The repository includes a `Dockerfile`.

The build flow:

1. install dependencies
2. generate Prisma client
3. build the Next.js app
4. copy runtime files into the final image
5. run `npm run start`

## PM2

There is an `ecosystem.config.js` for process manager based deployments.

Use this only when the target environment is a VM or server where PM2 is the chosen process manager.

For the production VM, prefer the deploy script:

```bash
cd /home/startpraynow/prayer-coin
npm run deploy:prod
```

The production script uses `npm install`, not `npm ci`, so newly changed
dependencies can be installed after `git pull` before rebuilding and restarting.

## Useful Runbooks

Root-level runbooks may contain older operational notes, but they are still useful when working with the current deployment:

- [`deploy.md`](../deploy.md)
- [`PROD_DB_MIGRATION_RUNBOOK.md`](../PROD_DB_MIGRATION_RUNBOOK.md)
- [`MEDIA_STORAGE_RUNBOOK.md`](../MEDIA_STORAGE_RUNBOOK.md)

## Pre-deploy Checks

Recommended checks:

```bash
npm run lint
npm run build
npx prisma migrate status
```

Also verify:

- public pages load
- sign-in works
- prayer card creation works
- image upload works
- global prayer room loads
- admin pages are protected
