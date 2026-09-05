#!/usr/bin/env bash
#
# Check for poll-deploy.sh. Runs the real script against a scratch git repo
# with pnpm/pm2 stubbed, so change detection, locking and reset-on-drift are
# exercised without touching the VPS.
#
# Needs Linux (flock, and bash that will not choke on CRLF), so run it in a
# container from the repo root:
#
#   docker run --rm -v "$PWD/deploy:/script:ro" #     -v "$PWD/deploy/poll-deploy.test.sh:/t.sh:ro" alpine:3.20 sh /t.sh
#
# On Git Bash prefix that with MSYS_NO_PATHCONV=1 or the /paths get mangled.
set -e
apk add --no-cache git bash util-linux >/dev/null 2>&1
T=/work && mkdir -p $T && cd $T
git init -q --bare origin.git
git clone -q origin.git src && cd src
git config user.email t@t; git config user.name t
echo one > f; git add -A; git commit -qm one; git branch -M master; git push -q origin master
cd $T && git clone -q origin.git target

cat > $T/stub.sh <<'EOS'
pnpm() { echo "  [stub] pnpm $*"; }
pm2()  { echo "  [stub] pm2 $*"; }
export -f pnpm pm2
EOS

run() { ( cd $T/target && REPO_DIR=$T/target LOCK_FILE=$T/lock bash -c "source $T/stub.sh; source /script/poll-deploy.sh" ); echo "   [exit $?]"; }

echo "=== 1. already up to date -> silent, exit 0 ==="
run
echo "=== 2. new commit upstream -> full deploy ==="
cd $T/src && echo two > f && git commit -qam "add feature two" && git push -q origin master
run
echo "=== 3. immediately again -> silent, exit 0 ==="
run
echo "=== 4. another deploy holds the lock -> skip, exit 0 ==="
cd $T/src && echo three > f && git commit -qam three && git push -q origin master
( exec 9>$T/lock; flock -n 9; run )
echo "=== 5. lock free again -> deploys ==="
run
echo "=== 6. local drift is discarded (reset --hard) ==="
cd $T/target && echo "hand-edited on the server" > f
cd $T/src && echo four > f && git commit -qam four && git push -q origin master
run
echo -n "   file now: "; cat $T/target/f
echo "=== 7. FORCE=1 with nothing to do -> redeploys anyway ==="
( cd $T/target && REPO_DIR=$T/target LOCK_FILE=$T/lock FORCE=1 bash -c "source $T/stub.sh; source /script/poll-deploy.sh" ); echo "   [exit $?]"
