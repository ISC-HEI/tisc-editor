<div align="center">
  <img alt="Tisc" src="../img/banner.jpg">
  <h1>TISC Editor — Client App</h1>
  <p>The Next.js frontend for the Typst Online ecosystem.</p>
</div>


## Features

The editor provides a full IDE-like experience in the browser:

- **Live Preview:** Instant rendering of SVG/PDF while typing.
- **Smart File System:** Manage folders and files with a VSCode editor.
- **Base64 Synchronization:** Assets (images, includes) are transferred via Base64 to the compilation server for maximum portability.
- **Collaboration:** Share projects with other users via email with granular access control.
- **Templates:** Instant project bootstrapping using GitHub-integrated templates.
- **Responsive IDE:** Zoom controls, split-pane view, and full-screen editor mode.

---

## Project Structure

```bash
src/
├── app
│   ├── api
│   │   └── projects        # API use for auto saving, compiling and exporting.
│   ├── dashboard           # Dashboard with the projects
│   ├── login               # Authentication pages
│   └── signup
├── assets                  # Authentication pages
├── components
│   ├── Dashboard           # Components usefull for the Dashboard
│   └── Editor              # Components usefull for the Editor
├── hooks                   # Usefull javascript functions
├── lib                     # libs for prisma, authentification and socket server
└── pages
    └── api                 # default route for websocket
```

## Getting Started

### Prerequisites
- **Node.js** (v20+) **or Bun**
- **Postgresql** instance

### Environment Setup
Create a `.env` file in the `app/` directory:
```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/tisc_db"

# GitHub API
# Needed to avoid rate limits when fetching templates
GITHUB_TOKEN="your_personal_access_token"
```

### Installation
```bash
bun install

bun x auth secret
bun x prisma migrate dev
bun x prisma generate

bun dev
```

## Technical Architecture

**1. Asset Management**  
    Unlike traditional editors, this app converts all local assets (images, fonts, nested files) into Base64 strings within the fileTree object. This allows the backend to be completely stateless and perform compilations without needing a shared persistent volume.

**2. GitHub Integration**  
    The template engine uses the GitHub Content API to pull official Typst packages.  
- Rate Limit Tip: If you are working in a team or deploying publicly, a GITHUB_TOKEN is mandatory to increase the limit from 60 to 5000 requests/hour.

## License
Licensed under the Apache License 2.0. See the [LICENSE](/LICENSE) file for more details.

## Disclaimer
This project is an independent work and is not affiliated with, endorsed by, or supported by the official Typst organization.
