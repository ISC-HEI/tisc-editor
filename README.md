<div align="center">
    <img alt="Tisc logo" src="./img/banner.jpg">
    <h1>
        TISC Editor
    </h1>
  
  <p><strong>A professional, full-stack solution for cloud-based Typst authoring.</strong></p>

  <div>
    <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
    <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" />
    <img src="https://img.shields.io/badge/Cypress-69D3A7?logo=cypress&logoColor=fff&style=for-the-badge" />
  </div>

  <br />

  [Explore Docs](./app/README.md) • [API Reference](./server/README.md) • [Report Bug](https://github.com/ISC-HEI/typst-editor/issues)
</div>

## Overview

TISC Editor is a **Dockerized monorepo** providing a professional environment for cloud-based Typst editing:

- **Web Editor:** VSCode-like interface, live preview, template gallery, collaboration.
- **Compilation API:** Stateless Typst to PDF/SVG rendering, Base64 asset handling.
- **Database Layer:** PostgreSQL managed with Prisma ORM.
- **Testing & CI/CD:** Full E2E coverage with Cypress, integrated in Docker lifecycle.


## Tech Stack

| Layer       | Technology |
|------------|------------|
| Frontend   | Next.js 16, TailwindCSS, Lucide Icons |
| Backend    | Node.js API with Typst binary integration |
| Database   | PostgreSQL, Prisma ORM |
| DevOps     | Docker Compose, GitHub Actions |
| Testing    | Cypress E2E |


## Key Features

| Component | Highlights |
| :--- | :--- |
| **Web Editor** | Real-time preview, VSCode-like editor, template gallery, multi-user project sharing |
| **Compilation API** | Typst to PDF/SVG rendering, isolated environments, Base64 image processing |
| **Architecture** | Dockerized monorepo, Prisma ORM, Next.js Server Actions |
| **Testing** | Automated End-to-End testing with Cypress integrated into Docker |


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
   (or directly in `docker-compose.yml`):

```env
GITHUB_TOKEN=your_github_token_here
```
> **Note**: Using a token increases the rate limit to **5,000 requests** per hour. If you plan to use the API concurrently with multiple users, you may need to request a higher-tier token. See the details [here](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api).

## Getting Started

### Prerequisites
- **Docker & Docker Compose** (Required)
- **Node.js / Bun** (Optional, for local development outside Docker)

### Deployment
To launch the entire stack (App, API, Database) and see the tests run automatically:
> Make sure you completed the [Configuration](#configuration--environment) before.
```bash
git clone https://github.com/ISC-HEI/typst-editor.git
cd tisc-editor
docker compose up -d --build
```
> Note: The test container will launch, execute the suite, and exit. The App, API, and Database will remain running in the background for you to work on.

* Editor UI: http://localhost:3000  
* Compilation API: http://localhost:3001

### Development Workflow
<details>
<summary><strong>Option A - Docker Compose (recommended)</strong></summary>

For active development, we recommend using the following command to see live logs while you code:
```bash
docker compose up --build
```

</details>

<details>
<summary><strong>Option B - Manual start (advanced)</strong></summary>

#### Database
First you need to start a PostgreSQL instance, with docker or on your device.

#### API
Then to start the API, see [here](server/README.md)

#### App
To start the App, see [here](app/README.md).


</details>

## Testing
The project includes a robust End-to-End (E2E) testing suite powered by **Cypress**. These tests ensure that critical user flows remain stable and functional.

**Tested Scenarios:**
- **Authentication:** Sign-up, Login, and Logout flows.
- **Project Lifecycle:** Creating projects using various templates (Blank, Thesis, Report).
- **Collaboration:** Sharing projects, handling non-existent users, self-sharing prevention, and managing permissions.

### Running Tests
To run the full suite and shut down the environment automatically (ideal for CI):
```bash
docker compose up --build --exit-code-from test
```
To run tests while the application is already running in development mode:
```bash
docker compose run test
```

## License
This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

## Disclaimer
This project is an independent work and is not affiliated with, endorsed by, or supported by the official Typst organization.
