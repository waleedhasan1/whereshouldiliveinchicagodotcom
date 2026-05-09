# Deploy runbook — Hetzner VPS + Cloudflare domain

Goal: this site live on your own domain, ~$4.50/mo + ~$10/yr.

## Step 1 — Buy a domain (5 min)

1. Sign up at https://dash.cloudflare.com (if you don't have an account).
2. Go to **Registrar** → **Register Domains** → search your name → buy. ~$10.44/yr for `.com` at cost.
3. After purchase, the domain auto-uses Cloudflare DNS (no nameserver change needed).

## Step 2 — Create the VPS (5 min)

1. Sign up at https://console.hetzner.com.
2. **Add SSH key first**: paste your `~/.ssh/id_ed25519.pub` (or generate one with `ssh-keygen -t ed25519`).
3. Create server:
   - Image: **Ubuntu 24.04**
   - Type: **CX22** (~$4.50/mo)
   - Location: **Ashburn, VA** (closest US East to Chicago) or **Hillsboro, OR**
   - SSH key: select the one you added
4. Note the public IPv4 address.

## Step 3 — Point DNS at the VPS (2 min)

In Cloudflare → your domain → **DNS** → add records:

| Type | Name | Content       | Proxy |
| ---- | ---- | ------------- | ----- |
| A    | @    | `<VPS_IPv4>`  | DNS only (gray cloud) |
| A    | www  | `<VPS_IPv4>`  | DNS only (gray cloud) |

Important: keep proxy **off** (gray cloud) for first install — Caddy needs port 80/443 reachable to fetch the cert. You can flip it on after.

## Step 4 — Run the bootstrap (10 min)

SSH in and run the installer:

```bash
ssh root@<VPS_IPv4>

# inside the box:
git clone https://github.com/<YOUR_USER>/whereshouldiliveinchicagodotcom.git /tmp/repo
bash /tmp/repo/deploy/install.sh whereshouldiliveinchicago.com https://github.com/<YOUR_USER>/whereshouldiliveinchicagodotcom.git
```

The script installs Node 22, Caddy, ufw, creates a `deploy` user, clones the repo to `/opt/wsil`, builds it, sets up systemd + Caddy, and starts everything.

## Step 5 — Set real API keys

```bash
nano /etc/wsil.env   # set OPENAI_API_KEY and RAPIDAPI_KEY
systemctl restart wsil
journalctl -u wsil -f   # tail logs to confirm it's healthy
```

Visit `https://whereshouldiliveinchicago.com` — first hit triggers Caddy to grab a Let's Encrypt cert.

## Step 6 — Wire up auto-deploy from GitHub (5 min)

On your **local machine**, generate a deploy key and put the public half on the VPS:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/wsil_deploy -N "" -C "github-actions"
ssh-copy-id -i ~/.ssh/wsil_deploy.pub deploy@<VPS_IPv4>
# test:
ssh -i ~/.ssh/wsil_deploy deploy@<VPS_IPv4> 'whoami'
```

In GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → add:

- `SSH_PRIVATE_KEY` — contents of `~/.ssh/wsil_deploy` (the private key)
- `SSH_HOST` — the VPS public IP
- `SSH_USER` — `deploy`

Push to `main` → the workflow at `.github/workflows/deploy.yml` runs `git pull && npm ci && npm run build && systemctl restart wsil` on the box.

## Day-to-day

- Logs: `journalctl -u wsil -f`
- Restart: `sudo systemctl restart wsil`
- Update deps: push to main, GitHub Actions handles it
- Caddy logs: `journalctl -u caddy -f`

## If something breaks

- App down → `systemctl status wsil` and check journal
- HTTPS fails → DNS A record not pointing here yet; wait for propagation (`dig whereshouldiliveinchicago.com`)
- 502 → app crashed on boot; usually a missing env var. `journalctl -u wsil -n 50`
- Out of memory during build → swap should cover it; if not, build locally and rsync `.next` over

## Costs

- Hetzner CX22: ~$4.50/mo
- Domain: ~$10.44/yr at Cloudflare Registrar
- Caddy + Let's Encrypt: $0
- GitHub Actions for public repos: $0

Total: **~$64/year**.
