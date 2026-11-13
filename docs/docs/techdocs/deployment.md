# Production Deployment

In production, the stack is deployed using the `publish_new_version.sh` script, which pulls the Docker images and starts all services (app, database, object storage, documentation, reverse proxy) without relying on `docker-compose`.

The images are **not built on the server**: the [Publish images](./devops/ci.md#publish-images) GitHub Actions workflow builds them on every push to `main` and pushes them to the GitHub Container Registry (GHCR), tagged with the commit SHA. This keeps the CPU- and memory-heavy build (Next.js, Docusaurus) off the production server.

| Image | Content |
| :--- | :--- |
| `ghcr.io/isc-hei/tisc-editor-app` | Next.js application |
| `ghcr.io/isc-hei/tisc-editor-docs` | Docusaurus documentation |

## Prerequisites

A `.env` file must exist at the project root, containing at least:

```env
AUTH_SECRET=
GITHUB_TOKEN=ghp_

AUTH_URL=https://tisc.isc-vs.ch
AUTH_KEYCLOAK_ID=your_app_id
AUTH_KEYCLOAK_SECRET=your_app_secret
AUTH_KEYCLOAK_ISSUER=https://sso.isc-vs.ch/realms/isc

DB_PASSWORD=your_db_password

# Garage (S3 object storage)
GARAGE_RPC_SECRET=<openssl rand -hex 32>

S3_ENDPOINT=http://garage:3900
S3_REGION=garage
S3_BUCKET=tisc-projects
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=GK<openssl rand -hex 12>
S3_SECRET_ACCESS_KEY=<openssl rand -hex 32>
```

:::info
See the [Configuration & Environment](./configuration) page for details on these variables.
:::

The Garage configuration file `garage/garage.toml` must also exist in the repository. It is mounted read-only into the Garage container.

:::warning
`GARAGE_RPC_SECRET` must be generated once and never changed afterwards. The access key and secret key (`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`) must follow Garage's format (`GK` followed by 24 hex characters for the key ID, 64 hex characters for the secret) to be importable.
:::

The two GHCR packages must be **public** so that the server can pull them without credentials. After the first run of the workflow, open each package on GitHub (organization → **Packages** → package → **Package settings**) and set its visibility to **Public**. This is done once.

:::info
If the packages must stay private, log the server in once instead, with a token that has the `read:packages` scope: `echo <token> | docker login ghcr.io -u <github-user> --password-stdin`.
:::

## Installing the fonts

You need to start by installing the fonts on the server, it run automaticly in the script but you may need to install `fontconfig`:

```bash
apt-get update && apt-get install -y fontconfig
```

## Deploying

```bash
./scripts/publish_new_version.sh --db
```

- The `--db` flag (re)creates and starts the PostgreSQL container (`tisc-db`) **and** the Garage container (`tisc-garage`). Omit it if both are already running.
- Without this flag, the script only redeploys the app, the docs, and nginx, reusing the existing database and object storage.

:::tip
Use `--db` on the very first deployment, or whenever the database or Garage container was removed. For routine redeployments, omit it to avoid unnecessary downtime on the database and the storage.
:::

Data is kept in named Docker volumes, so it survives container recreation:

| Volume | Content |
| :--- | :--- |
| `tisc_db_data` | PostgreSQL data |
| `tisc_garage_meta` | Garage metadata |
| `tisc_garage_data` | Garage stored objects |

## First-time Garage setup

Garage does not store anything until a cluster layout is applied, and the bucket and access key must be declared. This is done **once**, after the first `--db` deployment:

```bash
source .env

# 1. Assign and apply the layout (single node)
NODE_ID=$(docker exec tisc-garage /garage node id -q | cut -d@ -f1)
docker exec tisc-garage /garage layout assign -z dc1 -c 10G "$NODE_ID"
docker exec tisc-garage /garage layout apply --version 1

# 2. Create the bucket
docker exec tisc-garage /garage bucket create "$S3_BUCKET"

# 3. Import the access key from .env and grant it access to the bucket
docker exec tisc-garage /garage key import --yes -n tisc-app "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY"
docker exec tisc-garage /garage bucket allow --read --write --owner "$S3_BUCKET" --key tisc-app
```

:::info
Adjust the capacity (`-c 10G`) to the disk space you want to dedicate to Garage. You can check the cluster state at any time with `docker exec tisc-garage /garage status`.
:::

## What the script does

| Step | Action |
| :--- | :--- |
| **1. Images** | Pulls the app and docs images tagged with the current commit SHA (`git rev-parse HEAD`), or with `IMAGE_TAG` if set. The version shown in the app is computed by the workflow at build time. |
| **2. Network** | Creates the `tisc-network` Docker network if it doesn't exist. |
| **3. Database** *(if `--db`)* | Starts PostgreSQL and waits for it to be ready (`pg_isready`). |
| **4. Object storage** *(if `--db`)* | Starts Garage (`tisc-garage`, S3 API on port `3900`, internal network only) and waits for `garage status` to succeed. |
| **5. Application** | Starts the `tisc-app-prod` container and waits for the API to respond. |
| **6. Prisma** | Applies the database schema via `prisma db push`. |
| **7. Documentation** | Starts the `tisc-docs` container and waits for it to be ready. |
| **8. Reverse proxy** | Starts nginx (`tisc-nginx`) on port `8082`, routing traffic to the app and the docs according to `nginx/default.conf`. |
| **9. Cleanup** | Frees disk space by removing old images and any leftover Docker build cache (see below). |

At each step, the script actively polls until the previous service is up before moving on, avoiding cascading startup failures.

## Disk cleanup

Each deployment pulls new images, which leaves the previous versions on the disk. At the end of the script, the following commands are run to free space:

| Command | Effect |
| :--- | :--- |
| `docker image prune -f` | Removes dangling (untagged) images. |
| `docker image prune -af --filter "until=24h"` | Removes images older than 24 hours that are not used by any container, such as the previous app and docs versions. Images of running containers (PostgreSQL, Garage, nginx, app, docs) are kept. |
| `docker builder prune -af` | Removes any Docker build cache (nothing is built on the server anymore). |

`docker system df` is printed before and after the cleanup to show the space reclaimed. A failure during the cleanup never fails the deployment.

:::info
Docker volumes are **never** pruned, so the database (`tisc_db_data`) and Garage (`tisc_garage_meta`, `tisc_garage_data`) data are always kept. Stopped containers are not removed either.
:::

## Access

Once deployment is complete:

- Application: `http://localhost:8082`
- Documentation: `http://localhost:8082/docs/`

The Garage S3 API is **not** exposed on the host: it is only reachable from other containers on `tisc-network` (the app uses `http://garage:3900`).

## Updating

To publish a new version, simply rerun the script (without `--db` if the database and Garage already exist):

```bash
./scripts/publish_new_version.sh
```

The previous containers (`tisc-app-prod`, `tisc-docs`, `tisc-nginx`) are automatically removed and recreated with the new image.

The images of the checked-out commit must already be published (check the **Publish images** workflow on GitHub). To deploy another version, for example to roll back, pass its commit SHA:

```bash
IMAGE_TAG=<commit-sha> ./scripts/publish_new_version.sh
```

:::warning
The nginx container is exposed on port `8082`. Make sure this matches your reverse proxy / firewall configuration for the production host.
:::