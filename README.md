<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/ISC-HEI/isc-logos/main/white/ISC%20Logo%20inline%20white%20v3%20-%20large.webp">
  <img align="right" src="https://raw.githubusercontent.com/ISC-HEI/isc-logos/main/black/ISC%20Logo%20inline%20black%20v3%20-%20large.webp" alt="ISC Logo" height="50"/>
</picture>

<div align="center">
    <img alt="Tisc logo" src="./.github/assets/banner.jpg">
    <h1>
        TISC Editor
    </h1>
  
  <p><strong>A full-stack solution for cloud-based Typst authoring.</strong></p>

  <div>
    <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
    <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" />
    <img src="https://img.shields.io/badge/Socket.io-010101?style=for-the-badge&logo=socketdotio&logoColor=white" />
  </div>

  <br />

  [Explore Docs](./app/README.md) • [Dev URL](https://tisc.isc-vs.dev) • [Report Bug](https://github.com/ISC-HEI/tisc-editor/issues)
</div>

## Overview

TISC Editor is a **Dockerized repo** providing a professional environment for cloud-based Typst editing:

- **Web Editor:** VSCode-like interface, live preview, template gallery, collaboration.
- **Compilation API:** Stateless Typst to PDF/SVG rendering, Base64 asset handling.
- **Database Layer:** PostgreSQL managed with Prisma ORM.
- **CI/CD:** Automated build and formatting checks on every push and pull request via GitHub Actions.


## Tech Stack

| Layer       | Technology |
|------------|------------|
| Frontend   | Next.js 16, TailwindCSS, Lucide Icons, Socket.io-client |
| Backend    | Node.js API with Typst binary integration, Socket.io-server |
| Database   | PostgreSQL, Prisma ORM |
| DevOps     | Docker Compose, GitHub Actions |


## Key Features

| Component | Highlights |
| :--- | :--- |
| **Web Editor** | Multi-user editing with content synchronization, active users presence, and live notifications (Toasts). |
| **Compilation API** | Typst to PDF/SVG rendering, isolated environments, Base64 image processing |
| **Architecture** | Dockerized monorepo, Prisma ORM, Next.js Server Actions |


## Real-time Collaboration & Sync

TISC Editor uses a WebSocket layer (Socket.io) to enable seamless collaboration:

- **State Sync:** Automatic synchronization of the file tree and document content across all connected clients.
- **User Presence:** Real-time indicator of active collaborators on a project with a detailed hover-list of participant emails.
- **Smart Feedback:** Integrated notification system (Toasts) for user join/leave events and file system actions.

## Configuration & Environment
### GitHub API Rate Limiting (Template Gallery)

The editor fetches **Typst templates from public GitHub repositories** to enable template-based project creation.

This requires calling the **GitHub REST API** for:
- Searching repositories
- Reading repository metadata
- Fetching template files

By default, GitHub limits unauthenticated requests to **60 requests per hour per IP**.
This limit is quickly exceeded during normal usage (template browsing, searches, multiple users),
which may result in:
- Missing templates
- Failed searches
- GitHub API rate-limit errors (403)

To avoid this, you must configure a **Personal Access Token**.

### GitHub Token Setup

1. **Create a Token:** Go to https://github.com/settings/tokens and generate a
   **Personal Access Token (classic)**.  
   No special scopes are required for public repositories.

2. **Update your `.env`:** Add the token to the app environment file

```env
GITHUB_TOKEN=your_github_token_here
```
> **Note**: Using a token increases the rate limit to **5,000 requests** per hour. If you plan to use the API concurrently with multiple users, you may need to request a higher-tier token. See the details [here](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

### Next.js Auth Secret

1. **Create a random secret**, you can generate one via `openssl rand -base64 32`
2. **Update your `.env`:** Add the secret to the app environment file

```env
AUTH_SECRET=your_auth_secret_here
```

## Getting Started

### Prerequisites
- **Docker & Docker Compose** (Required)
- **Node.js / Bun** (Optional, for local development outside Docker)

### Development Deployment Docker
To launch the entire stack (App, API, Database):
> Make sure you completed the [Configuration](#configuration--environment) before.
```bash
git clone https://github.com/ISC-HEI/tisc-editor.git
cd tisc-editor
docker compose -f docker-compose-dev.yml up -d --build
```

* Editor UI: http://localhost:3000

### Development Workflow
<details>
<summary><strong>Option A - Docker Compose (recommended)</strong></summary>

For active development, we recommend using the following command to see live logs while you code:
```bash
docker compose -f docker-compose-dev.yml up --build
```

</details>

<details>
<summary><strong>Option B - Manual start (advanced)</strong></summary>

#### Database
First you need to start a PostgreSQL instance, with docker or on your device.

#### App With API
To start the App and the API, see [here](app/README.md).


</details>

## Production Deployment

1. You need to build the editor image
```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
APP_VER=$(git describe --tags --always --first-parent --dirty=.dev)$([ "$BRANCH" != "main" ] && echo "-$BRANCH")
docker build --build-arg NEXT_PUBLIC_APP_VERSION=$APP_VER -t isc-hei/tis-editor:latest ./app
docker network create tisc-network
```

2. If you don't already have a database, you can start one here
```bash
docker run -d \
  --name tisc-db \
  --network tisc-network \
  -e POSTGRES_USER=tisc_user \
  -e POSTGRES_PASSWORD=YOUR_PASSWORD \
  -e POSTGRES_DB=tisc_db \
  -v tisc_db_data:/var/lib/postgresql/data \
  postgres:15
```

3. Start your app on local
```bash
docker run -d \
  --name tisc-app-prod \
  --network tisc-network \
  -p 8082:3000 \
  -e DATABASE_URL=postgresql://tisc_user:YOUR_PASSWORD@tisc-db:5432/tisc_db \
  -e AUTH_SECRET=YOUR_SECRET  \
  -e AUTH_URL=https://tisc.isc-vs.dev \
  -e GITHUB_TOKEN=YOUR_TOKEN \
  --restart unless-stopped \
  isc-hei/tis-editor:latest
```

4. Initialize the tables in the db
```bash
docker exec tisc-app-prod npx prisma db push --url="postgresql://tisc_user:YOUR_PASSWORD@tisc-db:5432/tisc_db"
```

### Script Automation
The `publish_new_version.sh` script automates the deployment process. After pushing your changes to the repository, run the following on the server:
```bash
./publish_new_version.sh
```

**Options:**
To reset or start the database container along with the application, use the `--db` flag:
```bash
./publish_new_version.sh --db
```

> All infos is configurable in this script.

## CI/CD

The project uses **GitHub Actions** to automatically validate every push and pull request to `main`. Workflows live under `.github/workflows/`.

| Workflow | File | What it checks |
| :--- | :--- | :--- |
| **Build** | `build.yml` | Installs dependencies and runs `bun run build` from `app/` to make sure the project compiles. |
| **Format** | `format.yml` | Installs dependencies and runs `bun run format:check` (Prettier) from `app/` to make sure the codebase is consistently formatted. |

A local **pre-commit hook** (via Husky) also runs `bun run format:check` before each commit, so formatting issues are caught before code even reaches CI.

> More checks (linting, tests) will be added to the pipeline over time.

## Diagram

```mermaid
graph TD
    subgraph Client_Side [Client / Browser]
        UI[Editor UI - Next.js]
        SIOC[Socket.io Client]
    end

    subgraph Docker_Container [TISC Editor Stack]
        NextJS[Next.js Server]
        SIOS[Socket.io Server]
        Typst[Typst Binary / Compiler]
        Prisma[Prisma ORM]
    end

    subgraph Storage
        DB[(PostgreSQL)]
    end

    %% Interactions
    UI -->|HTTP / Server Actions| NextJS
    SIOC <-->|Real-time Sync| SIOS
    SIOS <--> Prisma
    NextJS <--> Prisma
    Prisma <--> DB
    NextJS -->|Exec| Typst
```

## License
This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

## Disclaimer
This project is an independent work and is not affiliated with, endorsed by, or supported by the official Typst organization.
