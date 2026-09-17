# Contributing to TISC Editor Documentation

Thank you for contributing to the TISC Editor documentation! This guide describes the workflow to follow for any change.

## Table of contents

- [Prerequisites](#prerequisites)
- [Workflow](#workflow)
  - [1. Create an issue](#1-create-an-issue)
  - [2. Assign the issue](#2-assign-the-issue)
  - [3. Create a branch](#3-create-a-branch)
  - [4. Write the documentation](#4-write-the-documentation)
  - [5. Commit following Conventional Commits](#5-commit-following-conventional-commits)
  - [6. Open a Pull Request](#6-open-a-pull-request)

## Prerequisites

- [Bun](https://bun.sh/) installed
- [Docker](https://www.docker.com/) installed and running
- A GitHub account with access to [isc-hei/tisc-editor](https://github.com/isc-hei/tisc-editor)

## Workflow

### 1. Create an issue

Every contribution starts with a [GitHub issue](https://github.com/isc-hei/tisc-editor/issues/new). The issue should describe:

- What needs to be added, fixed, or changed
- The affected page(s), if known
- Any relevant context or screenshots

Do not start working before an issue exists — it's the reference point for the branch, the commits, and the Pull Request.

### 2. Assign the issue

Assign the issue to yourself (or ask a maintainer to assign it to you) before starting any work. This avoids duplicate effort and makes it clear who is responsible for the change.

### 3. Create a branch

Create a branch from `main`, referencing the issue number:

```bash
git checkout main
git pull origin main
git checkout -b <type>/<issue-number>-<short-description>
```

Example:

```bash
git checkout -b docs/42-fix-installation-guide
```

### 4. Write the documentation

If the change applies to documentation content, write or edit it under `/docs`:

```
docs/
├── tutorial/       # User Tutorial sidebar content
└── techdocs/       # Technical Documentation sidebar content
```

Guidelines:

- Use Markdown (`.md`) or MDX (`.mdx`) if React components are needed.
- Diagrams can be written with [Mermaid](https://mermaid.js.org/):

  ````md
  ```mermaid
  graph TD;
    A-->B;
  ```
  ````

- Not every issue requires a documentation change (e.g. a config or dependency fix) — only write in `/docs` if applicable to the issue.

### 5. Commit following Conventional Commits

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <description>
```

Common types:

| Type    | Usage                                                        |
|---------|---------------------------------------------------------------|
| `docs`  | Adding or updating documentation content                      |
| `fix`   | Fixing an error, typo, or broken link                         |
| `feat`  | New site feature (plugin, page, navbar item, etc.)            |
| `style` | Formatting changes (CSS, typography) with no content impact   |
| `chore` | Maintenance tasks (dependencies, configuration, tooling)      |

Reference the issue number in the commit body or footer:

```
docs(tutorial): fix installation guide steps

Refs #42
```

### 6. Open a Pull Request

Push your branch and open a Pull Request targeting `main`:

```bash
git push origin <type>/<issue-number>-<short-description>
```

The PR should:

- Have a clear, descriptive title
- Reference the issue it closes (`Closes #42`)
- Be reviewed and approved before merging
