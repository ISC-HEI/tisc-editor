<div align="center">
    <h1>
        <img alt="Typst" src="https://user-images.githubusercontent.com/17899797/226108480-722b770e-6313-40d7-84f2-26bebb55a281.png">
        Typst Online Editor
    </h1>
  
  <p><strong>A professional, full-stack solution for cloud-based Typst authoring.</strong></p>

  <div>
    <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white" />
    <img src="https://img.shields.io/badge/Prisma-3982CE?style=for-the-badge&logo=Prisma&logoColor=white" />
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

## Tech Stack

- **Frontend:** Next.js 16, TailwindCSS, Lucide Icons.
- **Backend:** Node.js API with Typst binary integration.
- **Database:** PostgreSQL with Prisma ORM.
- **DevOps:** Docker Compose, GitHub Actions (CI/CD).

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js (Optional, for local development)

### One-Command Setup
The entire stack (App, API, Database) can be launched instantly:
```bash
git clone [https://github.com/ISC-HEI/typst-editor.git](https://github.com/ISC-HEI/typst-editor.git)
cd typst-editor
docker compose up -d --build
```
*The editor will be available at http://localhost:3000 and the API at http://localhost:3001*

> For developement start, please see both README.

## Configuration & Environment (optional)

To support frequent template searches and avoid GitHub API rate limiting, you must configure a Personal Access Token.

1. **Create a Token:** Go to [GitHub Settings](https://github.com/settings/tokens) and generate a **Personal Access Token (classic)**. No specific scopes are required for public repositories.
2. **Update your `.env`:** Add your token to the `app/` environment file:

```env
GITHUB_TOKEN=your_github_token_here
```
> **Note:** Without this token, GitHub limits requests to 60 per hour per IP. With a token, this limit is increased to 5,000 requests per hour.

## Repository Structure
```bash
.
├── app/            # Frontend Next.js application
├── server/         # Node.js Typst Compilation Service
├── docker-compose.yml
└── LICENSE
```