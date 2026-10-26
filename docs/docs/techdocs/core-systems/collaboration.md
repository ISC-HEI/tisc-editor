# Real-time Collaboration

Real-time collaboration is implemented with **Socket.io**, on top of the WebSocket server initialized in [`/api/ws`](./api-endpoints#get-apiws)). The server-side logic lives in `lib/socketServer.ts`; the client-side logic lives in the `useTypstCollaboration` hook, used by the editor.

## Connecting and joining a document

The socket handshake is authenticated with the NextAuth session cookie: a middleware (`io.use`) decodes the JWT with `getToken` and stores the user ID in `socket.data.userId`. Connections without a valid session are rejected (`Unauthorized`). The user ID is never taken from the client payload.

A socket connection alone does not grant access to a project. After connecting, the client must explicitly join a document by emitting `join-document` with a `docId` (the project ID). The server then checks whether that user has a `ProjectAssignment` for that project before allowing the join — if not, it responds with an `error` event instead.

```mermaid
sequenceDiagram
    participant Client
    participant Server as Socket.io Server
    participant DB as PostgreSQL

    Client->>Server: connect (session cookie)
    Server->>Server: check Origin, getToken → socket.data.userId
    Server->>DB: reject disabled users
    Client->>Server: join-document { docId }
    Server->>DB: findUnique ProjectAssignment
    alt Authorized
        DB-->>Server: assignment found
        Server->>Server: socket.join(docId)
        Server-->>Client: active-users-list [emails]
    else Not authorized
        DB-->>Server: no assignment
        Server-->>Client: error "Unauthorized"
    end
```

Once joined, the socket is stored server-side with an in-memory session (`{ userId, docId, authorized, email, role }`). Every subsequent event from that socket is checked against `session.authorized && session.docId === docId` before being relayed; write events (`edit-file`, `create-node`, `rename-node`, `delete-node`, `set-main-file`) are additionally ignored unless `role` is `owner` or `editor`.

The role is re-read from the database at most every **10 seconds** (`ROLE_TTL_MS`) when an event arrives, so a member who is removed or downgraded loses access within a few seconds without having to reconnect. A removed member receives an `error` event and is taken out of the room.

Additional safeguards:

- **Origin check:** the handshake is rejected if its `Origin` header does not match the request host (`Host` / `X-Forwarded-Host`) or `AUTH_URL`. CORS does not apply to WebSocket upgrades, so this check prevents cross-site WebSocket hijacking.
- **Disabled accounts** are refused at connection time.
- **Switching documents:** joining another document first leaves the previous room and removes the socket from its active users list.
- **Payload validation:** events with malformed fields (e.g. non-string paths, `changes` not being an array, `type` other than `file`/`folder`) are silently dropped.

## Events reference

### Client → Server

| Event | Payload | Description |
| --- | --- | --- |
| `join-document` | `{ docId }` | Authorizes and joins a project's collaboration room |
| `edit-file` | `{ docId, filename, changes }` | Broadcasts a Monaco content change |
| `cursor-change` | `{ docId, filename, selection }` | Broadcasts the local cursor position / selection |
| `create-node` | `{ docId, path, type }` | Broadcasts file/folder creation |
| `rename-node` | `{ docId, oldPath, newPath }` | Broadcasts a rename |
| `delete-node` | `{ docId, path }` | Broadcasts a deletion |
| `set-main-file` | `{ docId, path }` | Broadcasts a change of the main compiled file |
| `comments-changed` | `{ docId, created }` | Tells other members to reload the [comments](./comments). `created: true` (new thread or reply) requires a commenting role |

### Server → Client

| Event | Payload | Description |
| --- | --- | --- |
| `active-users-list` | `string[]` (emails) | Full list of currently active, unique users on the document |
| `remote-edit` | `{ filename, changes, userId }` | A file change made by another collaborator |
| `remote-cursor` | `{ filename, selection, userId, email }` | Another collaborator's cursor/selection |
| `node-created` / `node-renamed` / `node-deleted` | path-related fields | A file system change made by another collaborator |
| `remote-set-main` | `{ path }` | The main file was changed by another collaborator |
| `comments-changed` | — | Comments were changed by another member: reload them with `listComments` |
| `error` | `string` | Authorization or connection error |

All server → client events except `active-users-list` are relayed with `socket.to(docId).emit(...)`, meaning the sender of the original action never receives their own event back.

## Presence

The server keeps an in-memory map of active users per document (`activeUsers[docId][socketId] = email`). Because a user can have multiple sockets open (e.g. two tabs), the list sent to clients is deduplicated by email before being broadcast. On the client, joining and leaving triggers toast notifications, computed by diffing the new user list against the previous one.

## Remote cursors and selections

Cursor and selection data is rendered using Monaco's `deltaDecorations` API. Each collaborator is assigned a deterministic color derived from their email (`stringToColor`), used consistently for their cursor, their selection highlight, and their name label. A cursor is only rendered if the remote user is currently viewing the **same file** as the local user; switching files clears their decorations from the editor.

## Content synchronization

Local edits are sent immediately over `edit-file` as Monaco change objects (range + text), not full file contents. On the receiving end, changes are applied two ways depending on whether the affected file is currently open:

- If it is the file currently open in the editor, the changes are converted into Monaco edit operations and applied directly to the live model (preserving the undo stack).
- If it is a different file, the change is applied to the in-memory file tree as plain text (`applyMonacoChangesToString`), so it stays consistent even though it's not rendered.

After any remote edit, a **debounced recompile** (1 second) is triggered to refresh the preview.

:::info[No operational transform]

Changes are currently relayed as raw Monaco diffs and applied in the order they are received, with no conflict-resolution algorithm (such as OT or CRDT). A mutex-based synchronization mechanism is planned to prevent concurrent edits from being applied simultaneously. This will be implemented at a later stage as the system evolves.


:::

## File tree structural changes

Creating, renaming, deleting a file/folder, and changing the main file are broadcast the same way as content edits: the acting client applies the change locally first, then emits the corresponding event so other clients replay it on their own copy of the tree.