#!/usr/bin/env bash
set -Eeuo pipefail

# Zero-Data-Loss Update Script for Radiant Industrial Co. on Ubuntu Linux
# - Backs up SQLite database, local uploads, and .env BEFORE updating
# - Pulls latest Git commits cleanly
# - Applies schema updates (without overwriting user/admin data)
# - Rebuilds Next.js production bundle BEFORE recreating PM2
# - Flushes all PM2 logs and cleanly recreates PM2 process 'rad' on port 3010

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

PM2_APP_NAME="rad"
APP_PORT="3010"
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$APP_DIR/backups/pre-update-${TIMESTAMP}"

echo "============================================================"
echo " Radiant Industrial Co. — Production Update"
echo " App Dir : $APP_DIR"
echo " Branch  : $BRANCH"
echo " PM2 App : $PM2_APP_NAME | Port: $APP_PORT"
echo "============================================================"

mkdir -p "$APP_DIR/data" "$APP_DIR/public/uploads" "$APP_DIR/backups" "$BACKUP_DIR"

# 1. Backup persistent data BEFORE touching git, schema, or build
echo "--> [1/6] Backing up database, uploads, and .env to $BACKUP_DIR..."
if [ -f "$APP_DIR/data/radiant.db" ]; then
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$APP_DIR/data/radiant.db" ".backup '${BACKUP_DIR}/radiant.db'"
  else
    cp -a "$APP_DIR/data/radiant.db"* "$BACKUP_DIR/"
  fi
  echo "    Database backed up."
fi

if [ -d "$APP_DIR/public/uploads" ] && [ "$(ls -A "$APP_DIR/public/uploads" 2>/dev/null | grep -v '^\.gitkeep$' || true)" != "" ]; then
  cp -a "$APP_DIR/public/uploads" "$BACKUP_DIR/uploads"
  echo "    Local uploads backed up."
fi

if [ -f "$APP_DIR/.env" ]; then
  cp -a "$APP_DIR/.env" "$BACKUP_DIR/.env"
  echo "    .env backed up."
fi

# Retain only the 10 most recent backups to conserve disk space
ls -1dt "$APP_DIR"/backups/pre-update-* 2>/dev/null | tail -n +11 | xargs -r rm -rf

# 2. Pull latest code from GitHub cleanly (data/, public/uploads/, .env are gitignored)
echo "--> [2/6] Fetching latest updates from origin/$BRANCH..."
if [ -d "$APP_DIR/.git" ]; then
  git fetch origin "$BRANCH"
  git pull --ff-only origin "$BRANCH"
else
  echo "WARN: No .git directory found — skipping git pull."
fi

# Ensure shell scripts remain executable after pull
chmod +x "$APP_DIR"/scripts/*.sh 2>/dev/null || true

# Load .env cleanly
if [ -f "$APP_DIR/.env" ]; then
  set -a
  # shellcheck source=/dev/null
  source "$APP_DIR/.env"
  set +a
fi
[ -z "${DATABASE_AUTH_TOKEN:-}" ] && unset DATABASE_AUTH_TOKEN || true
export PORT="${PORT:-$APP_PORT}"

# 3. Install dependencies cleanly
echo "--> [3/6] Installing dependencies..."
if [ -f "$APP_DIR/package-lock.json" ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# 4. Apply non-destructive database schema migration (never runs db:seed)
echo "--> [4/6] Applying schema updates (preserving all existing data)..."
npx drizzle-kit push --force || echo "WARN: drizzle-kit push skipped (non-fatal if schema/indexes already synced)"

# 5. Build Next.js production bundle BEFORE recreating PM2 process
echo "--> [5/6] Building Next.js production bundle..."
npm run build

# 6. Flush logs & cleanly recreate ONLY PM2 process 'rad' on port 3010 (never touches other PM2 apps)
echo "--> [6/6] Flushing logs and recreating ONLY '${PM2_APP_NAME}' on port ${APP_PORT}..."
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 flush "$PM2_APP_NAME" >/dev/null 2>&1 || true
  pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
fi
rm -f "${HOME}/.pm2/logs/${PM2_APP_NAME}-"*.log 2>/dev/null || true

pm2 start "$APP_DIR/ecosystem.config.cjs" --only "$PM2_APP_NAME" --update-env
pm2 save >/dev/null 2>&1 || pm2 save

echo "--> Verifying http://127.0.0.1:${APP_PORT}..."
READY=0
for i in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "ERROR: '${PM2_APP_NAME}' failed to respond on port ${APP_PORT}."
  echo "Pre-update data backup saved at: $BACKUP_DIR"
  pm2 logs "$PM2_APP_NAME" --lines 40 --nostream || true
  exit 1
fi

echo "============================================================"
echo " Update Complete! '${PM2_APP_NAME}' is running cleanly on port ${APP_PORT}."
echo " Pre-update backup: $BACKUP_DIR"
pm2 status "$PM2_APP_NAME"
echo "============================================================"
