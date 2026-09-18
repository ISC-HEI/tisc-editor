# Production Deployment

In production, the stack is deployed using the `publish_new_version.sh` script, which builds the Docker images and starts all services (app, database, documentation, reverse proxy) without relying on `docker-compose`.

## Prerequisites

A `.env` file must exist at the project root, containing at least:

```env
AUTH_SECRET=
GITHUB_TOKEN=ghp_

AUTH_URL=http://tisc.isc-vs.ch
AUTH_KEYCLOAK_ID=your_app_id
AUTH_KEYCLOAK_SECRET=your_app_secret
AUTH_KEYCLOAK_ISSUER=https://sso.isc-vs.ch/realms/isc

DB_PASSWORD=your_db_password
```

:::info
See the [Configuration & Environment](./configuration) page for details on these variables.
:::

## Deploying

```bash
./publish_new_version.sh --db
```

- The `--db` flag (re)creates and starts the PostgreSQL container (`tisc-db`). Omit it if the database is already running.
- Without this flag, the script only redeploys the app, the docs, and nginx, reusing the existing database.

:::tip
Use `--db` on the very first deployment, or whenever the database container was removed. For routine redeployments, omit it to avoid unnecessary downtime on the database.
:::

## What the script does

| Step | Action |
| :--- | :--- |
| **1. Versioning** | Determines the version from `git describe` (suffixed with the branch name if not `main`). |
| **2. Build** | Builds the Docker images for the app (`isc-hei/tis-editor`) and the docs (`isc-hei/tisc-docs`). |
| **3. Network** | Creates the `tisc-network` Docker network if it doesn't exist. |
| **4. Database** *(if `--db`)* | Starts PostgreSQL and waits for it to be ready (`pg_isready`). |
| **5. Application** | Starts the `tisc-app-prod` container and waits for the API to respond. |
| **6. Prisma** | Applies the database schema via `prisma db push`. |
| **7. Documentation** | Starts the `tisc-docs` container and waits for it to be ready. |
| **8. Reverse proxy** | Starts nginx (`tisc-nginx`) on port `8082`, routing traffic to the app and the docs according to `nginx/default.conf`. |

At each step, the script actively polls until the previous service is up before moving on, avoiding cascading startup failures.

## Access

Once deployment is complete:

- Application: `http://localhost:8082`
- Documentation: `http://localhost:8082/docs/`

## Updating

To publish a new version, simply rerun the script (without `--db` if the database already exists):

```bash
./publish_new_version.sh
```

The previous containers (`tisc-app-prod`, `tisc-docs`, `tisc-nginx`) are automatically removed and recreated with the new image.

:::warning
The nginx container is exposed on port `8082`. Make sure this matches your reverse proxy / firewall configuration for the production host.
:::