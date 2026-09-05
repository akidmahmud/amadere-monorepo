#!/usr/bin/env bash
#
# Deploy amadere-monorepo by PULLING from origin/master.
#
# Why this exists instead of CI pushing over SSH: Hostinger's network-level
# abuse filtering blackholes inbound SSH from datacenter/cloud ASNs, which is
# exactly what GitHub-hosted runners are. Port 22 was blackholed first, we
# moved CI to 2222, and on 2026-09-05 that was blackholed too
# ("dial tcp ***:2222: i/o timeout" — a silent drop, not a refusal; sshd was
# healthy and both ports were reachable from a normal connection the whole
# time). Chasing a third port would just buy time until the next sweep.
#
# A pull needs no inbound connection at all, so no port and no source-ASN
# filter can break it again.
#
# Run by amadere-deploy.timer once a minute. Does nothing at all unless
# origin/master actually moved, so a quiet minute costs one `git fetch`.

set -euo pipefail

REPO_DIR="${REPO_DIR:-/var/www/amadere-monorepo}"
BRANCH="${BRANCH:-master}"
LOCK_FILE="${LOCK_FILE:-/tmp/amadere-deploy.lock}"

# A build takes minutes and the timer fires every minute, so overlapping runs
# are the normal case, not an edge case. Second and later callers exit
# immediately rather than queueing — the next tick will pick up whatever the
# running deploy did not.
# Guarded because `if ! flock` cannot tell "lock is held" (exit 1) from
# "flock is not installed" (exit 127), and the latter would make every tick
# report a phantom running deploy and silently never ship anything.
command -v flock >/dev/null || {
  echo "flock not found (install util-linux) — refusing to deploy without a lock." >&2
  exit 1
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "A deploy is already running — skipping this tick."
  exit 0
fi

cd "$REPO_DIR"

git fetch --quiet origin "$BRANCH"

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

# FORCE=1 rebuilds and restarts even when nothing changed. Needed for the
# very first run (the one-time `git reset` that puts this script on the box
# also makes HEAD match origin, so the timer would correctly do nothing and
# leave you with unbuilt code), and useful afterwards as a plain "redeploy"
# when a build is wedged or an .env changed.
if [ "$LOCAL" = "$REMOTE" ] && [ "${FORCE:-}" != "1" ]; then
  # Nothing to do. Deliberately silent so `journalctl -u amadere-deploy` is a
  # log of real deploys, not 1,440 "up to date" lines a day.
  exit 0
fi

if [ "$LOCAL" = "$REMOTE" ]; then
  echo "=== Forced redeploy of ${LOCAL:0:8} at $(date -Is) ==="
else
  echo "=== Deploying ${LOCAL:0:8} -> ${REMOTE:0:8} at $(date -Is) ==="
  git log --oneline "$LOCAL..$REMOTE" | sed 's/^/  /'
fi

# Mirror origin exactly — no local changes should ever exist on the deploy
# target, so reset rather than pull.
git reset --hard "origin/$BRANCH"

pnpm install --frozen-lockfile

# Apply any new DB migrations before rebuilding.
pnpm --filter @amader/db exec prisma migrate deploy

# turbo builds every app/package in the correct dependency order.
#
# IMPORTANT: never delete apps/*/.next before this build. The old PM2
# processes serve live traffic from that directory for the entire time this
# build runs (often minutes) — deleting it first made every deploy cause a
# window of real 404s / missing JS chunks (e.g. the admin sidebar) until
# `pm2 restart` below finally ran. If a *previous* deploy got killed mid-build
# and left a stale Next.js build lock, `pnpm build` will fail with "Another
# next build process is already running" — only then do we clear .next and
# retry, so the destructive cleanup only ever happens in that rare failure
# case, not on every deploy.
pnpm build || {
  echo "Build failed — clearing .next (possible stale build lock) and retrying once"
  rm -rf apps/admin/.next apps/web/.next
  pnpm build
}

pm2 restart backend admin web

echo "=== Deployed $(git rev-parse --short HEAD) at $(date -Is) ==="
