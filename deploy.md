# Prayer Coin Deployment Notes

## Environment Roles

- `startpraynow`
  - Project owner for `/home/startpraynow/prayer-coin`
  - Intended runtime user for `pm2`, `npm run build`, and normal deploy work
  - Does not have `sudo`

- `startpraynow_gmail_com`
  - Has `sudo`
  - Used only for host-level fixes: killing root-owned processes, fixing ownership, checking port `3000`, and repairing startup conflicts

## App Structure Summary

- Framework: Next.js App Router (`src/app`)
- Runtime: `next build` + `next start`
- Process manager: PM2 via [`ecosystem.config.js`](/home/startpraynow/prayer-coin/ecosystem.config.js)
- Port: `3000`
- Logs:
  - `/home/startpraynow/prayer-coin/logs/out.log`
  - `/home/startpraynow/prayer-coin/logs/error.log`
- Main concerns in this repo:
  - App pages and API routes are both in the same Next.js app
  - Static assets depend on a clean `.next` build and a clean server restart
  - Runtime ownership matters because PM2 writes to local log files

## Standard Deploy Flow

### Recommended one-command deploy

Use this as `startpraynow` after host ownership and port cleanup are healthy:

```bash
cd /home/startpraynow/prayer-coin
npm run deploy:prod
```

The script intentionally uses `npm install --include=dev` instead of `npm ci`.
This keeps production deploys able to install any newly added package changes after
`git pull`, while still installing dev dependencies that can be needed during
`next build`.

It runs:

1. `git fetch origin main`
2. `git pull --ff-only origin main`
3. `npm install --include=dev --no-audit --fund=false`
4. `npm run db:preflight:prod`（schema drift 時在 migration 前停止）
5. `npx prisma migrate deploy`
6. `npx prisma generate`
7. clean `.next`
8. `npm run build`
9. `pm2 restart prayer-coin --update-env` or first-time `pm2 start ecosystem.config.js`

If the server has local uncommitted edits or a non-fast-forward history, the pull
will stop instead of overwriting production files. Fix that state before
continuing.

### 1. Host cleanup with `startpraynow_gmail_com`

Use this only when port `3000` is blocked or ownership is broken.

```bash
sudo pkill -9 -f "next-server" || true
sudo pkill -9 -f "next start --port 3000" || true

sudo chown -R startpraynow:startpraynow /home/startpraynow/prayer-coin
sudo chown -R startpraynow:startpraynow /home/startpraynow/.pm2

sudo mkdir -p /home/startpraynow/prayer-coin/logs
sudo rm -f /home/startpraynow/prayer-coin/logs/out.log /home/startpraynow/prayer-coin/logs/error.log
sudo -u startpraynow touch /home/startpraynow/prayer-coin/logs/out.log /home/startpraynow/prayer-coin/logs/error.log
sudo chmod 755 /home/startpraynow/prayer-coin/logs
sudo chmod 644 /home/startpraynow/prayer-coin/logs/out.log /home/startpraynow/prayer-coin/logs/error.log

sudo ss -ltnp '( sport = :3000 )'
```

Expected result:

- Port `3000` should be empty before `startpraynow` starts PM2

### 2. Deploy with `startpraynow`

```bash
cd /home/startpraynow/prayer-coin

pm2 delete prayer-coin || true
pm2 kill || true

git fetch origin main
git pull --ff-only origin main

rm -rf .next
npm install --include=dev --no-audit --fund=false
npm run db:preflight:prod
npx prisma migrate deploy
npx prisma generate
npm run build

pm2 start ecosystem.config.js
pm2 save
pm2 status
pm2 logs prayer-coin --lines 30 --nostream
```

Expected result:

- `pm2 status` shows `prayer-coin` as `online`
- Logs do not contain `EADDRINUSE`
- Logs do not contain `EACCES`

## Fast Verification

Run as `startpraynow`:

```bash
git rev-parse --short HEAD
pm2 status prayer-coin
ss -ltnp '( sport = :3000 )'
```

What to confirm:

- Git commit matches expected deployed commit
- PM2 process is `online`
- Port `3000` is listening only once

## Incident Log From This Session

### What happened

1. `git pull origin main` initially failed because local changes blocked merge.
2. Local worktree was reset to remote `origin/main`.
3. A newer remote commit was fetched and fast-forwarded successfully.
4. PM2 restart attempts failed repeatedly.

### Root causes discovered

1. Port conflict on `3000`
   - PM2 failed with `EADDRINUSE`
   - A root-owned `next-server` process was already listening on `3000`
   - There was also evidence of a root-owned PM2 runtime under `/root/.pm2`

2. Ownership mismatch
   - The project path and log files were sometimes owned by the wrong user
   - `startpraynow` then failed to open `logs/out.log`
   - PM2 failed with `EACCES`

3. Mixed old/new deployment symptoms
   - Browser requested old hashed JS/CSS chunks
   - Some chunk requests returned `404`
   - Some runtime requests returned `500`
   - This happened because the active server process was not the same one that produced the latest `.next` build

### Working diagnosis

- The main deployment problem was not the `build` step
- The main deployment problem was that port `3000` was not cleanly controlled by a single runtime user and a single PM2 instance

## Common Failure Modes

### `EADDRINUSE: address already in use :::3000`

Meaning:

- Another process is already serving traffic on `3000`

Fix:

```bash
sudo ss -ltnp '( sport = :3000 )'
sudo pkill -9 -f "next-server"
sudo pkill -9 -f "next start --port 3000"
```

### `EACCES: permission denied, open '/home/startpraynow/prayer-coin/logs/out.log'`

Meaning:

- PM2 runtime user cannot write to project logs

Fix:

```bash
sudo chown -R startpraynow:startpraynow /home/startpraynow/prayer-coin
sudo chown -R startpraynow:startpraynow /home/startpraynow/.pm2
```

### Browser still shows old frontend after build

Meaning:

- The new build exists on disk, but the active process is still old or failed to restart

Fix:

- Confirm PM2 is `online`
- Confirm `3000` is owned by the expected process
- Hard refresh browser after a successful restart

## Suggested Improvements

### 1. Stop using two runtime identities for the same app

Current risk:

- `startpraynow`, `startpraynow_gmail_com`, and `root` all touched the same app lifecycle

Recommendation:

- Choose one runtime owner for the app
- Prefer `startpraynow` as the only deploy/runtime user
- Use `startpraynow_gmail_com` only for `sudo` repair tasks

### 2. Remove root-owned PM2 usage entirely

Current risk:

- Root PM2 can silently restart the app and steal port `3000`

Recommendation:

- Disable or delete root-owned PM2 app definitions
- Avoid starting Next.js manually as `root`

### 3. Add a single deploy script

Current risk:

- Manual deploy steps are error-prone

Recommendation:

- Add a script such as `scripts/deploy.sh`
- Include:
  - `git fetch`
  - `git reset --hard origin/main`
  - `rm -rf .next`
  - `npm install`
  - `npm run build`
  - `pm2 restart/start`

### 4. Consider external log management

Current risk:

- Local log files create ownership problems

Recommendation:

- Use PM2 default logging or system-managed logs
- If keeping file logs, ensure they are always created by `startpraynow`

### 5. Add a deployment marker

Current risk:

- It is hard to verify which commit is live

Recommendation:

- Expose commit SHA or build timestamp in the UI footer, admin page, or `/api/health`

### 6. Add a simple health check endpoint

Recommendation:

- Add `/api/health` that returns:
  - current commit SHA
  - uptime
  - environment
  - build timestamp

This will make it much easier to verify whether the browser is hitting the latest deployment.

## Architecture Review Notes

From the current repo layout:

- The project is a single Next.js application that serves:
  - public pages
  - admin pages
  - customer portal pages
  - API routes

This is workable, but it concentrates a lot of operational responsibility into one process.

Strengths:

- Single deployable unit
- Shared routing and UI stack
- Straightforward PM2 hosting model

Operational weaknesses:

- One failed restart affects frontend and API together
- File ownership and local logs can break startup
- Static asset mismatches are easy to hit during partial restarts

Recommended direction:

- Keep a single app for now
- Tighten deployment discipline first
- Only consider deeper architecture changes after deployment is stable

The highest-value improvements are operational, not structural:

1. One runtime user
2. One PM2 owner
3. One repeatable deploy script
4. One health endpoint
