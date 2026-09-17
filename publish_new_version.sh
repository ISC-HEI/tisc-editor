#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

ENV_FILE=".env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error : file $ENV_FILE not found in $(pwd)."
  echo "Create it from .env.example before running this script."
  exit 1
fi

set -a

source "$ENV_FILE"
set +a

: "${DB_PASSWORD:?DB_PASSWORD missing in $ENV_FILE}"
: "${AUTH_SECRET:?AUTH_SECRET missing in $ENV_FILE}"
: "${GITHUB_TOKEN:?GITHUB_TOKEN missing in $ENV_FILE}"
AUTH_URL="${AUTH_URL:-https://tisc.isc-vs.dev}"

DATABASE_URL="postgresql://tisc_user:${DB_PASSWORD}@tisc-db:5432/tisc_db"

# ---- Get the version ----
BRANCH=$(git rev-parse --abbrev-ref HEAD)
APP_VER=$(git describe --tags --always --first-parent --dirty=.dev)$([ "$BRANCH" != "main" ] && echo "-$BRANCH")
echo "==> Version : $APP_VER"

# ---- Build the image ----
docker build \
  --build-arg NEXT_PUBLIC_APP_VERSION="$APP_VER" \
  -t isc-hei/tis-editor:latest \
  ./app

# ---- Ensure the Docker network exists ----
docker network inspect tisc-network >/dev/null 2>&1 || docker network create tisc-network

# ---- If --db is passed, (re)start the database ----
if [[ "${1:-}" == "--db" ]]; then
  echo "==> Starting the db..."
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
fi

# ---- Start the app (remove the old instance if it exists) ----
echo "==> Waiting for the app to start..."
docker rm -f tisc-app-prod >/dev/null 2>&1 || true

docker run -d \
  --name tisc-app-prod \
  --network tisc-network \
  -p 8082:3000 \
  --env-file "$ENV_FILE" \
  -e DATABASE_URL="$DATABASE_URL" \
  -e AUTH_URL="$AUTH_URL" \
  --restart unless-stopped \
  isc-hei/tis-editor:latest

# ---- Wait for the app to be ready ----
echo "==> Waiting for the app to be ready..."
until docker exec tisc-app-prod curl -sf http://localhost:3000/api/ws >/dev/null 2>&1; do
  sleep 1
done
echo "==> App ready."

# ---- Apply the Prisma schema ----
echo "==> Push of the Prisma schema..."
docker exec tisc-app-prod npx prisma db push --url="$DATABASE_URL"

echo "==> Deployment completed (version $APP_VER)."