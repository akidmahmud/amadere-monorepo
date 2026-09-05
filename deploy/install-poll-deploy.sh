#!/usr/bin/env bash
#
# One-time setup for pull-based deploys. Run ON THE VPS, as the user that
# owns the checkout and the PM2 daemon (NOT as root — pm2 restart has to talk
# to that user's own daemon):
#
#   cd /var/www/amadere-monorepo && sudo -E bash deploy/install-poll-deploy.sh
#
# Re-running it is safe; it overwrites the units and reloads.

set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/amadere-monorepo}"
# sudo keeps the invoking user in SUDO_USER; that is who PM2 and the checkout
# belong to, and running the deploy as root would create root-owned files in
# node_modules and .next that the next non-root build cannot overwrite.
RUN_USER="${SUDO_USER:-$(id -un)}"

if [ "$RUN_USER" = "root" ]; then
  echo "Refusing to install: run this with sudo from your normal login user," >&2
  echo "not as root directly, or the deploy will run as root and break file" >&2
  echo "ownership in node_modules/.next and lose the PM2 daemon." >&2
  exit 1
fi

# systemd starts services with a near-empty PATH, so pnpm/pm2/node installed
# under a version manager (nvm, corepack, fnm) are invisible to the unit.
# Resolve them now, as the real user with their real profile, and bake the
# result in — this is the single most common way a working script fails once
# it is moved into a timer.
resolve() {
  local bin="$1" path
  path="$(sudo -u "$RUN_USER" -i bash -lc "command -v $bin" 2>/dev/null || true)"
  if [ -z "$path" ]; then
    echo "Could not find '$bin' on ${RUN_USER}'s login PATH." >&2
    echo "Install it, or edit /etc/amadere-deploy.env by hand afterwards." >&2
    exit 1
  fi
  echo "$path"
}

PNPM_BIN="$(resolve pnpm)"
PM2_BIN="$(resolve pm2)"
NODE_BIN="$(resolve node)"
TOOL_PATH="$(dirname "$NODE_BIN"):$(dirname "$PNPM_BIN"):$(dirname "$PM2_BIN")"

echo "user       : $RUN_USER"
echo "repo       : $REPO_DIR"
echo "node       : $NODE_BIN"
echo "pnpm       : $PNPM_BIN"
echo "pm2        : $PM2_BIN"

cat > /etc/amadere-deploy.env <<ENVEOF
REPO_DIR=$REPO_DIR
BRANCH=master
PATH=$TOOL_PATH:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENVEOF
chmod 0644 /etc/amadere-deploy.env

cat > /etc/systemd/system/amadere-deploy.service <<UNITEOF
[Unit]
Description=Deploy amadere-monorepo from origin/master
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$RUN_USER
WorkingDirectory=$REPO_DIR
EnvironmentFile=/etc/amadere-deploy.env
ExecStart=/usr/bin/env bash $REPO_DIR/deploy/poll-deploy.sh
# A cold full build runs several minutes; this only has to be longer than the
# worst case, and the flock in the script stops ticks from piling up anyway.
TimeoutStartSec=30min

[Install]
WantedBy=multi-user.target
UNITEOF

cat > /etc/systemd/system/amadere-deploy.timer <<TIMEREOF
[Unit]
Description=Check origin/master for new commits every minute

[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
AccuracySec=10s
Unit=amadere-deploy.service

[Install]
WantedBy=timers.target
TIMEREOF

chmod +x "$REPO_DIR/deploy/poll-deploy.sh"

systemctl daemon-reload
systemctl enable --now amadere-deploy.timer

echo
echo "Installed. The VPS now deploys itself within a minute of any push to master."
echo
echo "  watch a deploy : journalctl -u amadere-deploy -f"
echo "  deploy now     : sudo systemctl start amadere-deploy"
echo "  pause deploys  : sudo systemctl disable --now amadere-deploy.timer"
echo "  next run       : systemctl list-timers amadere-deploy.timer"
