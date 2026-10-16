# Roles & Permissions

Access to a project is entirely driven by the `ProjectAssignment` table (see [Database Schema](../architecture/database)), which links a `User` to a `Project` with a single `role`: `"owner"`, `"editor"`, `"commenter"` or `"viewer"`. There is no separate permissions table — every check in the app is a lookup of this one field.

## The four roles

| Role | Granted when | Typical capabilities |
| --- | --- | --- |
| `owner` | Automatically, when the project is created ([`createProject`](./server-actions#createprojectformdata)), or via [`transferProjectOwnership`](./server-actions#transferprojectownershipprojectid-newowneremail) | Full control: delete, archive, share, manage members, edit content |
| `editor` | Set by the owner when [sharing a project](./server-actions#shareprojectprojectid-shareduseremail-role--viewer) with `role: 'editor'`, or when approving an access request | Edit content, cannot manage sharing or delete the project |
| `commenter` | Set by the owner when sharing with `role: 'commenter'`, or when approving an access request | Read-only, plus can add and reply to [comments](./comments) |
| `viewer` | Default role when sharing a project | Read-only, can read comments but not write them |

A project always has **exactly one** `owner` at a time — `transferProjectOwnership` enforces this by updating both roles inside a single transaction (see [Server Actions](./server-actions#transferprojectownershipprojectid-newowneremail)).

## Permission matrix

| Capability | Owner | Editor | Commenter | Viewer | Enforced by |
| --- | :---: | :---: | :---: | :---: | --- |
| Delete the project | ✅ | ❌ | ❌ | ❌ | Server (`deleteProject`) |
| Archive / unarchive | ✅ | ❌ | ❌ | ❌ | Server (`setProjectActiveStatus`) |
| Share the project | ✅ | ❌ | ❌ | ❌ | Server (`shareProject`) |
| Remove a shared user | ✅ | ❌ | ❌ | ❌ | Server (`removeSharedUser`) |
| Transfer ownership | ✅ (as current owner) | ❌ | ❌ | ❌ | Server (`transferProjectOwnership`) |
| Leave the project | ✅ *(only if not the sole member — see below)* | ✅ | ✅ | ✅ | Server (`leaveProject`) |
| Duplicate the project | ✅  | ✅ | ✅ | ✅ | Server (`duplicateProject`) |
| Add / remove tags | ✅ | ✅ | ❌ | ❌ | Server (`addTagToProject`, `removeTagFromProject`) |
| Load / view the project | ✅ | ✅ | ✅ | ✅ | Server (`loadProject`) |
| Save file tree / edit content | ✅ | ✅ | ❌ | ❌ | Server (`/api/projects/save`) |
| Compile the project (preview) | ✅ | ✅ | ✅ | ✅ | Server (`/api/projects/compile`, authentication required) |
| Update the project thumbnail | ✅ | ✅ | ❌ | ❌ | Server (`/api/projects/compile`) |
| View the project thumbnail | ✅ | ✅ | ✅ | ✅ | Server (`GET /api/projects/[id]/thumbnail`) |
| Real-time edits (Socket.io) | ✅ | ✅ | ❌ | ❌ | Server (`socketServer.ts`, role re-checked at most every 10 s) |
| Handle access requests | ✅ | ❌ | ❌ | ❌ | Server (`resolveAccessRequest`) |
| Read comments | ✅ | ✅ | ✅ | ✅ | Server (`listComments`) |
| Add / reply to comments | ✅ | ✅ | ✅ | ❌ | Server (`createComment`, `replyToComment`) |
| Resolve / reopen a thread | ✅ | 🟡 *own threads* | 🟡 *own threads* | 🟡 *own threads* | Server (`setCommentResolved`) |
| Delete a comment | ✅ | 🟡 *own comments* | 🟡 *own comments* | 🟡 *own comments* | Server (`deleteComment`) |

## How the owner-only actions are enforced

Owner-only Server Actions all follow the same pattern: look up the caller's `ProjectAssignment`, and throw if `role !== 'owner'`. For example, `deleteProject` throws `Only project owners can delete the project`, `shareProject` throws `Only owner can share`, and so on — see [Server Actions](./server-actions) for the exact error messages per action. These checks run on the server, so they cannot be bypassed from the client.

### Leaving a project

`leaveProject` behaves differently depending on the caller's role:

- **Owner, sole member:** the project is deleted outright.
- **Owner, other members present:** the action throws, asking the owner to transfer ownership first.
- **Editor, commenter or viewer:** their assignment is simply removed.

## Write access is enforced server-side

Only `owner` and `editor` can modify a project. Write checks use an allow-list (`EDIT_ROLES` in `src/lib/comment-anchors.ts`) rather than `role !== 'viewer'`, so `commenter` is treated as read-only everywhere:

- [`POST /api/projects/save`](./api-endpoints#post-apiprojectssave) rejects callers without an assignment or whose role is not `owner`/`editor` (`403`).
- [`POST /api/projects/compile`](./api-endpoints#post-apiprojectscompile) requires an authenticated session (`401` otherwise). Compilation itself is stateless, so viewers can render the preview, but the project thumbnail is only updated when the caller is an `owner` or `editor` of `projectId`.
- The Socket.io [`join-document`](./collaboration#connecting-and-joining-a-document) handshake stores the caller's `role` in the socket session. Write events (`edit-file`, `create-node`, `rename-node`, `delete-node`, `set-main-file`) are ignored for viewers and commenters; `cursor-change` is still relayed. `comments-changed` (see [Comments](./comments)) is relayed for members allowed to comment, or for any member when it follows a resolve/delete. The role is refreshed from the database at most every 10 seconds, so revoked or downgraded members lose access without reconnecting.
- Tag edits (`addTagToProject`, `removeTagFromProject`) are rejected for viewers and commenters with `Viewers cannot edit tags`.

The **editor UI** additionally hides editing controls: `Toolbar.jsx` derives a `canEdit` flag from [`getProjectAssignmentRole`](./server-actions#getprojectassignmentroleprojectid) and disables Save, Open, and text formatting when the role is `viewer` or `commenter`.

## Where roles are checked, at a glance

| Layer | Role-aware? |
| --- | --- |
| Server Actions (`actions.ts`) | ✅ for ownership actions (delete, share, archive, remove user, transfer) |
| `/api/projects/save` | ✅ — owner or editor only |
| `/api/projects/compile` | ✅ — authentication required; thumbnail update for owner/editor only |
| Socket.io (`socketServer.ts`) | ✅ — write events rejected for `viewer` and `commenter` |
| Comments (`lib/actions/comments.ts`) | ✅ — see [Comments](./comments#permissions) |
| `/api/projects/[id]/thumbnail` | ✅ — project members only |
| Editor UI (`Toolbar.jsx`, etc.) | ✅ — hides/disables editing controls for `viewer` and `commenter` |