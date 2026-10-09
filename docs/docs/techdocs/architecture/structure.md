# Project Structure

This page describes how the repository and the `app` directory are organized.

## Root files
- **`Dockerfile`** — Container image definition for the app.
- **`docker-compose-dev.yml`** — The docker compose use in development (database, Garage object store, app, docs and reverse proxy).
- **`garage/garage.toml`** — Configuration of the Garage object store.
- **`scripts/garage-init.sh`** — One-time initialization of Garage (layout, bucket, access key).
- **`prisma/schema.prisma`** — Database schema definition.
- **`prisma.config.ts`** — Prisma configuration (used with `@prisma/adapter-pg`).
- **`next.config.ts`** — Next.js configuration.

## `src/app`

Follows the Next.js App Router convention. Contains pages, layouts, and API routes.

- **`api/[auth]/[...nextauth]`** — NextAuth catch-all route, handles the OIDC flow with Keycloak.
- **`api/projects`** — REST endpoints for project operations: compiling (`compile`), saving (`save`, which checks the user's role and quota, then uploads the changed files to the object store), and generating thumbnails (`[id]/thumbnail`).
- **`dashboard`** — The project dashboard page.
- **`login`** — The login page.

## `src/components`

React components, split by feature area:

- **`Dashboard`** — Components used on the dashboard: project cards, creation/edit modals, storage bar, sharing window.
- **`Editor`** — Components used inside the editor: file explorer, Monaco editor wrapper, preview pane, toolbar, breadcrumbs, context menu, logs.

## `src/config`

- **`fileExtensions.js`** — Configuration for file icons and authorization.


## `src/hooks`

Custom React hooks encapsulating stateful logic, notably:

- **`useEditor`** — Core editor state and behavior.
- **`useFileManager`** — File and folder operations (create, rename, delete, import).
- **`useTypstCollaboration`** — Real-time collaboration logic (cursors, selections, sync).
- **`useApi`**, **`useUtils`**, **`useZoom`**, **`refs`** — Supporting utilities.

## `src/lib`

Server-side logic and integrations:
- **`actions/`** — Server actions functions (project creation, loading, duplication, deletion, storage usage).
- **`auth.ts`** / **`auth.config.ts`** — NextAuth setup and configuration.
- **`prisma.ts`** — Prisma client instance.
- **`storage.ts`** — S3 client and low-level object operations (put, get, copy, delete, delete by prefix).
- **`project-storage.ts`** — Project-level storage logic: prepares files (encoding, size, hash, storage key), uploads them, reads their content and cleans up the objects of a deleted project.
- **`filetree.ts`** — Converts between the nested file tree used by the editor and the flat list of files stored in the database (`flattenTree` / `buildTree`), including the encoding of binary files.
- **`quota-service.ts`** — Storage quota calculation logic (sum of the size of the files of the projects a user owns).
- **`socketServer.ts`** — Socket.io server setup.
- **`template.ts`** — List of the [templates](../core-systems/templates).

## `src/pages/api/ws.ts`

WebSocket entry point. Uses the Pages Router API convention rather than the App Router, since Next.js's App Router does not support long-lived WebSocket connections in route handlers.

## `src/types`

Shared TypeScript types used across the app (file tree structure, editor markers, socket events, NextAuth session augmentation, dashboard stats cards).