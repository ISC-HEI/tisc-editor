#!/usr/bin/env bash
#
# check_and_deploy.sh
#
# Polls the origin repo for new commits on `main`. If the remote HEAD
# has moved since the last successful deploy, pulls and runs
# publish_new_version.sh.
#
# Intended to run on a schedule (systemd timer or cron) directly on
# the LXC, so it works without any inbound connection from GitHub.

set -euo pipefail

# --- Configuration -----------------------------------------------------
REPO_DIR="/root/tisc-editor"
BRANCH="main"
PUBLISH_SCRIPT="./scripts/publish_new_version.sh"
STATE_FILE="/var/lib/tisc-editor/last_deployed_sha"
LOCK_FILE="/var/lock/tisc-editor-deploy.lock"
LOG_TAG="tisc-deploy"

# --- Helpers -------------------------------------------------------------
log() {
    logger -t "$LOG_TAG" -- "$1"
    echo "[$LOG_TAG] $1"
}

# --- Prevent overlapping runs -------------------------------------------
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
    log "Another deploy check is already running, skipping."
    exit 0
fi

mkdir -p "$(dirname "$STATE_FILE")"

cd "$REPO_DIR"

# --- Find latest remote commit on the branch ------------------------------
REMOTE_SHA=$(git ls-remote origin "refs/heads/${BRANCH}" | awk '{print $1}')

if [ -z "$REMOTE_SHA" ]; then
    log "Could not resolve remote SHA for branch '${BRANCH}'. Aborting."
    exit 1
fi

LAST_SHA=""
if [ -f "$STATE_FILE" ]; then
    LAST_SHA=$(cat "$STATE_FILE")
fi

if [ "$REMOTE_SHA" = "$LAST_SHA" ]; then
    # Nothing new, exit quietly.
    exit 0
fi

log "New commit detected on '${BRANCH}': ${LAST_SHA:-<none>} -> ${REMOTE_SHA}"

# --- Pull and deploy -------------------------------------------------------
if ! git fetch origin "$BRANCH"; then
    log "git fetch failed. Aborting deploy."
    exit 1
fi

if ! git checkout "$BRANCH"; then
    log "git checkout failed. Aborting deploy."
    exit 1
fi

if ! git reset --hard "origin/${BRANCH}"; then
    log "git reset --hard failed. Aborting deploy."
    exit 1
fi

log "Running ${PUBLISH_SCRIPT}..."
if bash "$PUBLISH_SCRIPT"; then
    echo "$REMOTE_SHA" > "$STATE_FILE"
    log "Deploy succeeded. Recorded SHA ${REMOTE_SHA} as last deployed."
else
    log "publish_new_version.sh failed. NOT recording new SHA, will retry next run."
    exit 1
fi
