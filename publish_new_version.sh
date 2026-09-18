#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

git pull origin main

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
GIT_DESC=$(git describe --tags --always --first-parent --dirty=.dev)
if [ "$BRANCH" != "main" ]; then
  APP_VER="${GIT_DESC}-${BRANCH}"
else
  APP_VER="$GIT_DESC"
fi
echo "==> Version : $APP_VER"

# ---- Build the images ----
docker build \
  --build-arg NEXT_PUBLIC_APP_VERSION="$APP_VER" \
  -t isc-hei/tis-editor:latest \
  ./app


cp CHANGELOG.md docs/techdocs/changelog.md # Add changelog to docs for the next build

docker build \
  -f docs/Dockerfile \
  -t isc-hei/tisc-docs:latest \
  .

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
  isc-hei/tis-editor:latest

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
  isc-hei/tisc-docs:latest

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

echo "==> Deployment completed (version $APP_VER)."