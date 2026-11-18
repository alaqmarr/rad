#!/usr/bin/env bash
set -Eeuo pipefail

# Initial Ubuntu Linux Deployment Script for Radiant Industrial Co.
# - PM2 process name : rad
# - Port             : 3010
# - Data retention   : Never overwrites existing data/radiant.db, public/uploads, or .env

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

PM2_APP_NAME="rad"
APP_PORT="3010"
PUBLIC_URL="${1:-}"

echo "============================================================"
echo " Radiant Industrial Co. — Ubuntu Initial Setup"
echo " App Dir : $APP_DIR"
echo " PM2 App : $PM2_APP_NAME | Port: $APP_PORT"
echo "============================================================"

# 1. Install base system packages if missing (requires sudo if non-root)
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
  SUDO="sudo"
fi

if ! command -v curl >/dev/null 2>&1 || ! command -v git >/dev/null 2>&1 || ! command -v sqlite3 >/dev/null 2>&1; then
  echo "--> Installing prerequisites (curl, git, sqlite3, openssl)..."
  $SUDO apt-get update -y
  $SUDO apt-get install -y curl git sqlite3 openssl ca-certificates
fi

# 2. Ensure Node.js >= 20 LTS
NEED_NODE=0
if ! command -v node >/dev/null 2>&1; then
  NEED_NODE=1
else
  NODE_MAJOR="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
  if [ "$NODE_MAJOR" -lt 20 ]; then
    NEED_NODE=1
  fi
fi

if [ "$NEED_NODE" -eq 1 ]; then
  echo "--> Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
  $SUDO apt-get install -y nodejs
fi

echo "--> Node: $(node -v) | npm: $(npm -v)"

# 3. Ensure PM2 is installed globally
if ! command -v pm2 >/dev/null 2>&1; then
  echo "--> Installing PM2 globally..."
  $SUDO npm install -g pm2
fi

# 4. Ensure persistent directories exist
mkdir -p "$APP_DIR/data" "$APP_DIR/public/uploads" "$APP_DIR/backups"

# 5. Create .env only if missing (never overwrite an existing .env)
if [ ! -f "$APP_DIR/.env" ]; then
  echo "--> Creating initial .env file..."
  SECRET_GEN="$(openssl rand -base64 32 | tr -d '\n')"
  TARGET_URL="${PUBLIC_URL:-http://localhost:${APP_PORT}}"
  cat > "$APP_DIR/.env" <<EOF
# Database (LibSQL / SQLite)
DATABASE_URL="file:./data/radiant.db"
DATABASE_AUTH_TOKEN=""

# App Port (PM2 'rad' listens on 3010)
PORT=${APP_PORT}

# NextAuth
NEXTAUTH_URL="${TARGET_URL}"
NEXTAUTH_SECRET="${SECRET_GEN}"
EOF
  echo "    Created .env (NEXTAUTH_URL=${TARGET_URL})."
  echo "    Edit .env later if setting up a domain + HTTPS reverse proxy."
else
  echo "--> Existing .env retained."
fi

set -a
# shellcheck source=/dev/null
source "$APP_DIR/.env"
set +a
export PORT="${PORT:-$APP_PORT}"

# 6. Install npm dependencies cleanly
echo "--> Installing production & build dependencies..."
if [ -f "$APP_DIR/package-lock.json" ]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# 7. Push schema and seed ONLY if catalog is empty (retains existing data)
echo "--> Pushing Drizzle schema to SQLite..."
npx drizzle-kit push

DB_FILE="${APP_DIR}/data/radiant.db"
EXISTING_PRODUCTS=0
if [ -f "$DB_FILE" ]; then
  EXISTING_PRODUCTS="$(sqlite3 "$DB_FILE" "SELECT count(*) FROM products;" 2>/dev/null || echo "0")"
fi

if [ "${EXISTING_PRODUCTS:-0}" -eq 0 ]; then
  echo "--> Fresh database detected — running initial seed..."
  npm run db:seed
else
  echo "--> Existing database has ${EXISTING_PRODUCTS} products — skipping seed to retain all data."
fi

# 8. Build Next.js production bundle
echo "--> Building Next.js production bundle..."
npm run build

# 9. Flush logs and cleanly create ONLY PM2 process 'rad' on port 3010 (other PM2 apps untouched)
echo "--> Configuring PM2 process '${PM2_APP_NAME}' on port ${APP_PORT} (without disturbing other PM2 apps)..."
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 flush "$PM2_APP_NAME" >/dev/null 2>&1 || true
  pm2 delete "$PM2_APP_NAME" >/dev/null 2>&1 || true
fi
rm -f "${HOME}/.pm2/logs/${PM2_APP_NAME}-"*.log 2>/dev/null || true

pm2 start "$APP_DIR/ecosystem.config.cjs" --only "$PM2_APP_NAME" --update-env
pm2 save >/dev/null 2>&1 || pm2 save

# 10. Health check on port 3010
echo "--> Waiting for http://127.0.0.1:${APP_PORT} to become ready..."
READY=0
for i in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "ERROR: '${PM2_APP_NAME}' failed health check on port ${APP_PORT}. Recent logs:"
  pm2 logs "$PM2_APP_NAME" --lines 40 --nostream || true
  exit 1
fi

echo "============================================================"
echo " Deployment Complete!"
echo " App running via PM2 as '${PM2_APP_NAME}' on http://127.0.0.1:${APP_PORT}"
echo ""
echo " First-time Admin Setup:"
echo "   Visit http://YOUR_SERVER_IP:${APP_PORT}/setup (or https://your-domain/setup)"
echo ""
echo " Enable auto-start across server reboots (run if not yet configured):"
echo "   pm2 startup"
echo "============================================================"
