#!/usr/bin/env bash
# One-shot bootstrap for a fresh Ubuntu 24.04 box.
# Run as root: bash install.sh <domain> <git-https-url>
# Example:     bash install.sh whereshouldiliveinchicago.com https://github.com/USER/whereshouldiliveinchicagodotcom.git
#
# Idempotent: safe to re-run.
set -euo pipefail

DOMAIN="${1:?usage: install.sh <domain> <git-https-url>}"
REPO_URL="${2:?usage: install.sh <domain> <git-https-url>}"
APP_USER="deploy"
APP_DIR="/opt/wsil"
ENV_FILE="/etc/wsil.env"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root." >&2
  exit 1
fi

echo "==> Updating apt"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates gnupg git ufw debian-keyring debian-archive-keyring apt-transport-https

echo "==> Adding swap (1G) if none"
if ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Installing Node 22 LTS via NodeSource"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Installing Caddy"
if ! command -v caddy >/dev/null; then
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

echo "==> Configuring firewall (ufw)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
yes | ufw enable || true

echo "==> Creating $APP_USER user"
if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "$APP_USER"
fi

echo "==> Cloning/updating repo at $APP_DIR"
if [[ ! -d "$APP_DIR/.git" ]]; then
  git clone "$REPO_URL" "$APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
else
  sudo -u "$APP_USER" git -C "$APP_DIR" pull --ff-only
fi

echo "==> Writing env file template at $ENV_FILE (edit it after install)"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
# Edit these, then: systemctl restart wsil
NODE_ENV=production
PORT=3000
OPENAI_API_KEY=replace_me
RAPIDAPI_KEY=replace_me
EOF
  chmod 640 "$ENV_FILE"
  chown root:"$APP_USER" "$ENV_FILE"
fi

echo "==> Building app"
cd "$APP_DIR"
sudo -u "$APP_USER" npm ci
sudo -u "$APP_USER" npm run build

echo "==> Installing systemd unit"
install -m 644 "$APP_DIR/deploy/wsil.service" /etc/systemd/system/wsil.service
systemctl daemon-reload
systemctl enable wsil

echo "==> Installing Caddyfile (domain: $DOMAIN)"
sed "s|__DOMAIN__|$DOMAIN|g" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
systemctl restart caddy

echo "==> Granting deploy user permission to restart wsil without password"
cat > /etc/sudoers.d/wsil-deploy <<EOF
$APP_USER ALL=(root) NOPASSWD: /bin/systemctl restart wsil, /bin/systemctl status wsil
EOF
chmod 440 /etc/sudoers.d/wsil-deploy

echo "==> Starting wsil"
systemctl restart wsil

echo
echo "Done."
echo "Next:"
echo "  1) edit $ENV_FILE with real keys, then: systemctl restart wsil"
echo "  2) point DNS A record for $DOMAIN to this server's public IP"
echo "  3) Caddy will auto-fetch HTTPS cert on first request"
echo "  4) check status: systemctl status wsil; journalctl -u wsil -f"
