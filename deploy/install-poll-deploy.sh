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

[ -d "$REPO_DIR/.git" ] || {
  echo "$REPO_DIR is not a git checkout. Set REPO_DIR=... and re-run." >&2
  exit 1
}

# Run the deploy as whoever already OWNS the checkout, rather than as whoever
# happens to be running this installer.
#
# Getting this wrong is silently destructive in both directions: deploying as
# root onto a non-root checkout leaves root-owned files in node_modules/.next
# that the next build cannot overwrite, and deploying as a normal user onto a
# root-owned checkout fails outright. It also has to match the user whose PM2
# daemon owns the backend/admin/web processes, or `pm2 restart` cheerfully
# talks to an empty daemon and restarts nothing.
#
# On this box the checkout is root-owned and PM2 runs as root, which is a
# perfectly consistent setup — so root is accepted here rather than refused.
RUN_USER="${RUN_USER:-$(stat -c '%U' "$REPO_DIR")}"

id "$RUN_USER" >/dev/null 2>&1 || {
  echo "Cannot resolve the owner of $REPO_DIR ('$RUN_USER')." >&2
  echo "Set RUN_USER=<user> explicitly and re-run." >&2
  exit 1
}

# Whoever it is must be the one PM2 is running under, or the restart is a no-op.
if command -v pm2 >/dev/null 2>&1; then
  if ! sudo -u "$RUN_USER" -i pm2 pid backend >/dev/null 2>&1; then
    echo "WARNING: '$RUN_USER' has no PM2 process named 'backend'." >&2
    echo "         Deploys will build but restart nothing. Check 'pm2 ls'" >&2
    echo "         as the user that owns the running apps." >&2
  fi
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
