---
sidebar_position: 5
---

# Project Structure

This page describes how the `app` directory is organized.

## Root files
 
- **`Dockerfile`** — Container image definition for the app.
- **`docker-compose-dev.yml`** — The docker compose use in development.
- **`prisma/schema.prisma`** — Database schema definition.
- **`prisma.config.ts`** — Prisma configuration (used with `@prisma/adapter-pg`).
- **`next.config.ts`** — Next.js configuration.

## `src/app`

Follows the Next.js App Router convention. Contains pages, layouts, and API routes.

- **`api/[auth]/[...nextauth]`** — NextAuth catch-all route, handles the OIDC flow with Keycloak.
- **`api/projects`** — REST endpoints for project operations: compiling (`compile`), saving (`save`), and generating thumbnails (`[id]/thumbnail`).
- **`dashboard`** — The project dashboard page and its server actions.
- **`login`** — The login page.

## `src/components`

React components, split by feature area:

- **`Dashboard`** — Components used on the dashboard: project cards, creation/edit modals, storage bar, sharing window.
- **`Editor`** — Components used inside the editor: file explorer, Monaco editor wrapper, preview pane, toolbar, breadcrumbs, context menu, logs.

## `src/hooks`

Custom React hooks encapsulating stateful logic, notably:

- **`useEditor`** — Core editor state and behavior.
- **`useFileManager`** — File and folder operations (create, rename, delete, import).
- **`useTypstCollaboration`** — Real-time collaboration logic (cursors, selections, sync).
- **`useApi`**, **`useUtils`**, **`useZoom`**, **`refs`** — Supporting utilities.

## `src/lib`

Server-side logic and integrations:

- **`auth.ts`** / **`auth.config.ts`** — NextAuth setup and configuration.
- **`prisma.ts`** — Prisma client instance.
- **`quota-service.ts`** — Storage quota calculation logic.
- **`socketServer.ts`** — Socket.io server setup.

## `src/pages/api/ws.ts`

WebSocket entry point. Uses the Pages Router API convention rather than the App Router, since Next.js's App Router does not support long-lived WebSocket connections in route handlers.

## `src/types`

Shared TypeScript types used across the app (file tree structure, editor markers, socket events, NextAuth session augmentation, dashboard stats cards).