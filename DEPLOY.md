# Deployment Guide — GitHub & Ubuntu Linux Server

## 1. Push Code to GitHub (Local Windows / Dev Machine)

`.gitignore` excludes `.env`, `data/*.db*`, `public/uploads/*`, `backups/`, `.next/`, and `node_modules/`.
Only `.env.example`, `data/.gitkeep`, `public/uploads/.gitkeep`, and application source code are tracked.

```bash
git init
git add .
git status   # verify .env, data/radiant.db, backups/ are NOT listed
git commit -m "Initial production release for Radiant Industrial Co."
git branch -M main
git remote add origin https://github.com/<YOUR_ORG_OR_USER>/<YOUR_REPO>.git
git push -u origin main
```

---

## 2. Initial Deployment on Ubuntu Server (PM2: `rad`, Port: `3010`)

```bash
git clone https://github.com/<YOUR_ORG_OR_USER>/<YOUR_REPO>.git /var/www/radiant
cd /var/www/radiant
chmod +x scripts/setup-ubuntu.sh scripts/update-ubuntu.sh
./scripts/setup-ubuntu.sh https://radiantindustrial.in
```

What `scripts/setup-ubuntu.sh` does:
- Installs Node.js 20 LTS, `sqlite3`, and `pm2` if missing.
- Creates `.env` with a generated `NEXTAUTH_SECRET` and `PORT=3010` (skips if `.env` already exists).
- Runs `npm ci` and `npx drizzle-kit push`.
- Seeds initial catalog/settings **only** if `products` has `0` rows (existing data is always preserved).
- Builds the production app (`npm run build`).
- Flushes logs and starts PM2 process **`rad`** on port **`3010`** via `ecosystem.config.cjs`.

To enable auto-start on server reboot:
```bash
pm2 startup
# run the exact command printed by pm2 startup, then:
pm2 save
```

After first boot, visit `/setup` (`https://radiantindustrial.in/setup` or `http://<SERVER_IP>:3010/setup`) to create your initial Admin account, then configure R2, SMTP, AI API Key, and WhatsApp in `/admin/settings`.

---

## 3. Updating on Ubuntu Server (Zero Data Loss)

Whenever you push new commits to GitHub, run on the Ubuntu server:

```bash
cd /var/www/radiant
./scripts/update-ubuntu.sh
```

Or specify a branch: `./scripts/update-ubuntu.sh main`

What `scripts/update-ubuntu.sh` guarantees:
1. **Automatic Pre-Update Backup** (`backups/pre-update-<TIMESTAMP>/`) of `data/radiant.db` (via SQLite hot `.backup`), `public/uploads/`, and `.env` (retains the latest 10 backups).
2. **Clean Git Pull** (`git pull --ff-only origin <branch>`).
3. **Retains All Live Data**: runs additive `npx drizzle-kit push` (never runs `db:seed` on updates).
4. **Builds Before Restart**: runs `npm ci` + `npm run build` before touching PM2.
5. **Flushes Logs & Recreates ONLY `rad`**: checks `pm2 describe rad`, runs `pm2 flush rad` + `pm2 delete rad` + clears `rad-*.log`, then starts `ecosystem.config.cjs --only rad --update-env` on port **`3010`** and saves (`pm2 save`) — other PM2 processes and their logs are never disturbed or restarted.

---

## 4. Nginx Reverse Proxy Example (Optional for HTTPS on Port 80/443)

```nginx
server {
    listen 80;
    server_name radiantindustrial.in www.radiantindustrial.in;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
