# API Reference

This page documents the internal API routes used by the app.

## Authentication

### `GET / POST /api/[auth]/[...nextauth]`

Catch-all route handled directly by NextAuth's `handlers`. Manages the entire OIDC flow with Keycloak (sign-in, callback, sign-out, session, CSRF, etc.). See [Authentication & SSO](./authentication) for details on the underlying configuration.

```typescript
import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
```

---

## Projects

### `POST /api/projects/compile`

Compiles a Typst project and returns the rendered output.

**Request body**

| Field | Type | Description |
| --- | --- | --- |
| `fileTree` | `FileTreeNode` | The full project file tree (required) |
| `mainFile` | `string` | Path of the main `.typ` file to compile, relative to the tree root (required) |
| `format` | `'svg' \| 'pdf'` | Output format. Defaults to `svg` |
| `sync` | `boolean` | If `true` (and `format` is `svg`), injects invisible position markers to support edit-sync (see below) |
| `projectId` | `string` | Optional. If provided, triggers an async thumbnail regeneration after a successful compile |

**Response**

- If `format` is `pdf`: raw PDF bytes with `Content-Type: application/pdf`.
- Otherwise, a JSON object:

```json
{
  "success": true,
  "svg": "<svg>...</svg>",
  "syncMarkers": [{ "line": 12, "page": 1, "x": 42.5, "y": 88.0 }],
  "logs": [{ "type": "success", "msg": "Compilation successful", "time": "10:32:00" }]
}
```

On a compilation error, the route still responds with HTTP `200` and `success: false`, along with an error log entry — this lets the editor display compiler errors without treating them as network failures.

**How it works**

1. The file tree is written to a temporary, isolated directory (`typst-<sessionId>` in the OS temp folder).
2. If `sync` is enabled, invisible metadata markers are injected into the main file so their rendered position (page, x, y) can be queried after compilation, allowing the preview to scroll to the location matching the cursor in the editor.
3. The project is compiled using `NodeCompiler` from `@myriaddreamin/typst-ts-node-compiler`.
4. If `projectId` is provided, a thumbnail is regenerated in the background (see below), throttled to avoid running too often.
5. All temporary files and directories are deleted once compilation finishes, whether it succeeded or not.

:::warning[Size limits]

Each individual file is limited to **5 MB**. The total size of all files written to disk for a single compilation is limited to **10 MB**; exceeding it aborts the compilation with an error.

:::

:::info[Thumbnail throttling]

When `projectId` is set, a new thumbnail is only generated if the existing one is missing or older than **2 minutes**, to avoid regenerating it on every keystroke while the user is actively editing.

:::

### `POST /api/projects/save`

Persists a project's file tree, enforcing the user's storage quota.

**Authentication:** Required. Returns `401` if there is no active session.

**Request body**

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | Project ID |
| `fileTree` | `FileTreeNode` | The full, updated file tree to save |

**Response**

- `200` — `{ "success": true }`
- `403` — Quota exceeded. Body is a plain text message with current usage and limit, e.g. `Quota exceeded (10.42MB / 10.00MB)`.
- `500` — Unexpected server error.

**How it works**

The quota check only applies when the new file tree is **larger** than the project's previous size. It computes the combined size of the user's other owned projects plus the new size of the current one; if that total exceeds `storageQuota` (see [Database Schema](./database)), the save is rejected before anything is written. The check and the update run inside a single Prisma transaction to avoid race conditions between concurrent saves.

### `GET /api/projects/[id]/thumbnail`

Returns the stored thumbnail image for a project.

**Response**

- `200` — Image bytes, with `Content-Type` set to the stored `mimeType`, cached for 60 seconds (`Cache-Control: public, max-age=60, must-revalidate`) and an `ETag` based on the last update time.
- `404` — No thumbnail exists for this project.

---

## Real-time

### `GET /api/ws`

Initializes the Socket.io server on first call, attaching it to the underlying Node HTTP server. This route intentionally lives under the **Pages Router** (`pages/api/ws.ts`) rather than the App Router, since persistent WebSocket connections are not supported by App Router route handlers.

Subsequent calls are no-ops if the Socket.io server is already attached (`res.socket.server.io` check). This route does not return meaningful data — it exists purely to trigger server initialization; actual real-time communication happens over the WebSocket connection itself, not through further HTTP calls to this endpoint.