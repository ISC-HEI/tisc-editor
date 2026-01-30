<div align="center">
    <h1>
        <img alt="Tisc logo" src="./img/banner.jpg">
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

## Key Features

| Component | Highlights |
| :--- | :--- |
| **Web Editor** | Real-time preview, VSCode-like editor, template gallery, multi-user project sharing. |
| **Compilation API** | Typst to PDF/SVG rendering, isolated environments, Base64 image processing. |
| **Architecture** | Dockerized monorepo, Prisma ORM for seamless DB management, Next.js Server Actions. |
| **Testing** | Automated End-to-End testing with Cypress, integrated into the Docker lifecycle. |

## Tech Stack

- **Frontend:** Next.js 16, TailwindCSS, Lucide Icons.
- **Backend:** Node.js API with Typst binary integration.
- **Database:** PostgreSQL with Prisma ORM.
- **DevOps:** Docker Compose, GitHub Actions (CI/CD).

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

## Getting Started

### Prerequisites
- **Docker & Docker Compose** (Required)
- **Node.js / Bun** (Optional, for local development outside Docker)

### One-Command Setup
To launch the entire stack (App, API, Database) for development and see the tests run automatically:
> Please do the [Configuration](#configuration--environment) before.
```bash
git clone https://github.com/ISC-HEI/typst-editor.git
cd tisc-editor
docker compose up -d --build
```
> Note: The test container will launch, execute the suite, and exit. The App, API, and Database will remain running in the background for you to work on.

* Editor UI: http://localhost:3000  
* Compilation API: http://localhost:3001

### Development Workflow

For active development, we recommend using the following command to see live logs while you code:
```bash
docker compose up --build
```

## Configuration & Environment

To support frequent template searches and avoid GitHub API rate limiting, you must configure a Personal Access Token.

1. **Create a Token:** Go to [GitHub Settings](https://github.com/settings/tokens) and generate a **Personal Access Token (classic)**. No specific scopes are required for public repositories.
2. **Update your `.env`:** Add your token to the `app/` environment file: Or add it in the docker compose in the app.

```env
GITHUB_TOKEN=your_github_token_here
```
> **Note:** Without this token, GitHub limits requests to 60 per hour per IP. With a token, this limit is increased to 5,000 requests per hour.

## Repository Structure
```bash
.
├── app/              # Frontend Next.js application
├── server/           # Node.js Typst Compilation Service
├── cypress/          # Cypress E2E specs and support files
├── cypress.config.js # Cypress configuration
├── docker-compose.yml
└── LICENSE
```

## License
This project is licensed under the Apache License, Version 2.0. See the [LICENSE](LICENSE) file for details.

## Disclaimer
This project is an independent work and is not affiliated with, endorsed by, or supported by the official Typst organization.
