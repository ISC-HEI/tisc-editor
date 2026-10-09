#!/usr/bin/env bash
# One-time Garage setup (layout, bucket, access key). Safe to re-run.
# Usage: ./scripts/garage-init.sh
set -euo pipefail

cd "$(dirname "$0")/.."

# Read only the variables we need: sourcing .env would execute every line
# (a "$" in any value, e.g. a password hash, breaks it).
env_get() {
  grep -E "^$1=" .env | head -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

S3_BUCKET=$(env_get S3_BUCKET)
S3_ACCESS_KEY_ID=$(env_get S3_ACCESS_KEY_ID)
S3_SECRET_ACCESS_KEY=$(env_get S3_SECRET_ACCESS_KEY)

for var in S3_BUCKET S3_ACCESS_KEY_ID S3_SECRET_ACCESS_KEY; do
  if [ -z "${!var}" ]; then
    echo "Missing $var in .env" >&2
    exit 1
  fi
done

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose-dev.yml}"
G="docker compose -f $COMPOSE_FILE exec -T garage /garage"

echo "Waiting for Garage..."
for i in $(seq 1 30); do
  if $G status >/dev/null 2>&1; then break; fi
  if [ "$i" -eq 30 ]; then
    echo "Garage did not become ready. Last error:" >&2
    $G status >&2 || true
    echo "--- container logs ---" >&2
    docker compose -f "$COMPOSE_FILE" logs --tail 30 garage >&2
    exit 1
  fi
  sleep 1
done

if $G bucket info "$S3_BUCKET" >/dev/null 2>&1; then
  echo "Bucket '$S3_BUCKET' already exists, nothing to do."
  exit 0
fi

NODE_ID=$($G node id -q | cut -d@ -f1)

$G layout assign -z dc1 -c 10G "$NODE_ID"
$G layout apply --version 1

$G bucket create "$S3_BUCKET"
$G key import --yes "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" -n tisc-app
$G bucket allow --read --write --owner "$S3_BUCKET" --key tisc-app

echo "Garage ready: bucket '$S3_BUCKET'."