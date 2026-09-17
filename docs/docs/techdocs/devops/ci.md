# Continuous Integration

The project uses **GitHub Actions** to automatically check every push and pull request against the `main` branch. Four workflows run independently: **Build**, **Format**, **Lint**, and **Build Docs**.

## Triggers

All three workflows share the same trigger:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

They run on `ubuntu-latest`, using **Bun** (via `oven-sh/setup-bun@v2`) instead of Node/npm, and all commands run from the `app` working directory.

## Workflows

### Build

Ensures the app compiles successfully.

```yaml
- run: bun install --frozen-lockfile
- run: bun x prisma generate
- run: bun run build
```

The Prisma client is generated before building, since `bun run build` (Next.js build) would otherwise fail on missing generated types — the same issue that can occur locally if `prisma generate` hasn't been run after cloning or after a schema change.

### Format

Checks that the codebase follows the project's Prettier formatting rules, without modifying any files.

```yaml
- run: bun install --frozen-lockfile
- run: bun run format:check
```

This mirrors the `format` script (`prettier --write .`) available locally, but using `format:check` so CI fails instead of silently rewriting files.

### Lint

Runs ESLint against the codebase.

```yaml
- run: bun install --frozen-lockfile
- run: bun run lint
```

:::info[Consistent with local hooks]

The project also uses **Husky** and **lint-staged** to run similar checks automatically on commit. These CI workflows act as a safety net, catching anything that slipped through — for example, changes pushed without going through a local commit hook, or a hook that was skipped with `--no-verify`.

:::

### Build Docs

Ensures the Docusaurus documentation site builds successfully. Same principle as the app's Build workflow, but running against the `docs` directory instead of `app`.

```yaml
- run: bun install --frozen-lockfile
  working-directory: docs

- run: bun run build
  working-directory: docs
```

## Summary

| Workflow | Command | Working directory | Purpose |
| --- | --- | --- | --- |
| Build | `bun run build` | `app` | Confirms the app builds without errors |
| Format | `bun run format:check` | `app` | Confirms code is properly formatted |
| Lint | `bun run lint` | `app` | Confirms code passes ESLint rules |
| Build Docs | `bun run build` | `docs` | Confirms the documentation site builds without errors |

All workflows must pass before a pull request can be merged into `main` (assuming branch protection is enabled on the repository).