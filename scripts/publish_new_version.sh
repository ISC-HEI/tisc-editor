#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

ENV_FILE=".env"
GARAGE_CONFIG="$(pwd)/garage/garage.toml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error : file $ENV_FILE not found in $(pwd)."
  echo "Create it from .env.example before running this script."
  exit 1
fi

if [ ! -f "$GARAGE_CONFIG" ]; then
echo "Error : garage config $GARAGE_CONFIG not found."
exit 1
fi

# Read a single variable from .env literally (no shell expansion, so values
# containing '$' are safe). The same file is passed as-is to docker --env-file.
get_env() {
grep -E "^$1=" "$ENV_FILE" | tail -n1 | cut -d= -f2- || true
}

DB_PASSWORD="$(get_env DB_PASSWORD)"
AUTH_SECRET="$(get_env AUTH_SECRET)"
GITHUB_TOKEN="$(get_env GITHUB_TOKEN)"
GARAGE_RPC_SECRET="$(get_env GARAGE_RPC_SECRET)"
AUTH_URL="$(get_env AUTH_URL)"

: "${DB_PASSWORD:?DB_PASSWORD missing in $ENV_FILE}"
: "${AUTH_SECRET:?AUTH_SECRET missing in $ENV_FILE}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN missing in $ENV_FILE}"
: "${GARAGE_RPC_SECRET:?GARAGE_RPC_SECRET missing in $ENV_FILE}"
AUTH_URL="${AUTH_URL:-https://tisc.isc-vs.dev}"

DATABASE_URL="postgresql://tisc_user:${DB_PASSWORD}@tisc-db:5432/tisc_db"

# ---- Pull the images ----
# Images are built by GitHub Actions (.github/workflows/publish-images.yml) and tagged
# with the commit SHA. Set IMAGE_TAG to deploy another commit (e.g. a rollback).
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse HEAD)}"
APP_IMAGE="ghcr.io/isc-hei/tisc-editor-app:${IMAGE_TAG}"
DOCS_IMAGE="ghcr.io/isc-hei/tisc-editor-docs:${IMAGE_TAG}"
echo "==> Images : $IMAGE_TAG"

docker pull "$APP_IMAGE"
docker pull "$DOCS_IMAGE"

# ---- Ensure the Docker network exists ----
docker network inspect tisc-network >/dev/null 2>&1 || docker network create tisc-network

# ---- If --db is passed, (re)start the database and garage ----
if [[ "${1:-}" == "--db" ]]; then
  echo "==> Starting the postgres db..."
  docker rm -f tisc-db >/dev/null 2>&1 || true

  docker run -d \
    --name tisc-db \
    --network tisc-network \
    -e POSTGRES_USER=tisc_user \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB=tisc_db \
    -v tisc_db_data:/var/lib/postgresql/data \
    --restart unless-stopped \
    postgres:15

  echo "==> Waiting for Postgres to be ready..."
  until docker exec tisc-db pg_isready -U tisc_user -d tisc_db >/dev/null 2>&1; do
    sleep 1
  done
  echo "==> Postgres ready."

  echo "==> Starting garage (S3 storage)..."
  docker rm -f tisc-garage >/dev/null 2>&1 || true

  docker run -d \
    --name tisc-garage \
    --network tisc-network \
    --network-alias garage \
    -e GARAGE_RPC_SECRET="$GARAGE_RPC_SECRET" \
    -v "$GARAGE_CONFIG":/etc/garage.toml:ro \
    -v tisc_garage_meta:/var/lib/garage/meta \
    -v tisc_garage_data:/var/lib/garage/data \
    --restart unless-stopped \
    dxflrs/garage:v2.4.1

  echo "==> Waiting for Garage to be ready..."
  until docker exec tisc-garage /garage status >/dev/null 2>&1; do
    sleep 1
  done
  echo "==> Garage ready."

fi

# ---- Start the app (remove the old instance if it exists) ----
echo "==> Starting the app..."
docker rm -f tisc-app-prod >/dev/null 2>&1 || true

docker run -d \
  --name tisc-app-prod \
  --network tisc-network \
  --network-alias app \
  --env-file "$ENV_FILE" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e AUTH_URL="$AUTH_URL" \
  --restart unless-stopped \
  "$APP_IMAGE"

echo "==> Waiting for the app to be ready..."
until docker exec tisc-app-prod sh -c '
  wget -q -T 2 -O /dev/null http://127.0.0.1:3000/api/ws
  status=$?
  [ "$status" -eq 0 ] || [ "$status" -eq 8 ]
'; do
  sleep 1
done
echo "==> App ready."

# ---- Apply the Prisma schema ----
echo "==> Push of the Prisma schema..."
docker exec tisc-app-prod npx prisma db push --url="$DATABASE_URL"

# ---- Start the docs site ----
echo "==> Starting the docs..."
docker rm -f tisc-docs >/dev/null 2>&1 || true

docker run -d \
  --name tisc-docs \
  --network tisc-network \
  --network-alias docs \
  --restart unless-stopped \
  "$DOCS_IMAGE"

echo "==> Waiting for the docs to be ready..."
until docker exec tisc-docs sh -c '
  wget -q -T 2 -O /dev/null http://127.0.0.1:3001/docs/
  status=$?
  [ "$status" -eq 0 ] || [ "$status" -eq 8 ]
'; do
  sleep 1
done
echo "==> Docs ready."

# ---- Start nginx (reverse proxy for app + docs) ----
echo "==> Starting nginx..."
docker rm -f tisc-nginx >/dev/null 2>&1 || true

docker run -d \
  --name tisc-nginx \
  --network tisc-network \
  -p 8082:80 \
  -v "$(pwd)/nginx/default.conf:/etc/nginx/conf.d/default.conf:ro" \
  --restart unless-stopped \
  nginx:1.27-alpine

echo "==> Waiting for nginx to be ready..."
until curl -sf http://localhost:8082 >/dev/null 2>&1; do
  sleep 1
done
echo "==> Nginx ready."

# ---- Free disk space (volumes are never touched, DB/Garage data is safe) ----
echo "==> Cleaning up Docker resources..."
docker system df || true

# Untagged images
docker image prune -f || true
# Images not used by any container, e.g. previous versions (running containers are protected)
docker image prune -af --filter "until=24h" || true
# Build cache (nothing is built on this server anymore, images come from GHCR)
docker builder prune -af || true

echo "==> Disk usage after cleanup:"
docker system df || true

echo "==> Deployment completed (version $APP_VER)."