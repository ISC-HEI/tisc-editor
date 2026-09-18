# Roles & Permissions

Access to a project is entirely driven by the `ProjectAssignment` table (see [Database Schema](../architecture/database)), which links a `User` to a `Project` with a single `role`: `"owner"`, `"editor"` or `"viewer"`. There is no separate permissions table — every check in the app is a lookup of this one field.

## The three roles

| Role | Granted when | Typical capabilities |
| --- | --- | --- |
| `owner` | Automatically, when the project is created ([`createProject`](./server-actions#createprojectformdata)), or via [`transferProjectOwnership`](./server-actions#transferprojectownershipprojectid-newowneremail) | Full control: delete, archive, share, manage members, edit content |
| `editor` | Set by the owner when [sharing a project](./server-actions#shareprojectprojectid-shareduseremail-canedit--false) with `canEdit: true` | Edit content, cannot manage sharing or delete the project |
| `viewer` | Default role when sharing a project (`canEdit: false`) | Intended to be read-only in the editor UI |

A project always has **exactly one** `owner` at a time — `transferProjectOwnership` enforces this by updating both roles inside a single transaction (see [Server Actions](./server-actions#transferprojectownershipprojectid-newowneremail)).

## Permission matrix

| Capability | Owner | Editor | Viewer | Enforced by |
| --- | :---: | :---: | :---: | --- |
| Delete the project | ✅ | ❌ | ❌ | Server (`deleteProject`) |
| Archive / unarchive | ✅ | ❌ | ❌ | Server (`setProjectActiveStatus`) |
| Share the project | ✅ | ❌ | ❌ | Server (`shareProject`) |
| Remove a shared user | ✅ | ❌ | ❌ | Server (`removeSharedUser`) |
| Transfer ownership | ✅ (as current owner) | ❌ | ❌ | Server (`transferProjectOwnership`) |
| Leave the project | ✅ *(only if not the sole member — see below)* | ✅ | ✅ | Server (`leaveProject`) |
| Add / remove tags | ✅ | ✅ | ✅ | Server, but **not role-restricted** — any assignment qualifies |
| Load / view the project | ✅ | ✅ | ✅ | Server (`loadProject`) |
| Save file tree / edit content | ✅ | ✅ | 🟡 *technically allowed* | UI-only (see below) |
| Compile the project | ✅ | ✅ | 🟡 *technically allowed* | Not checked at all (see below) |
| Real-time edits (Socket.io) | ✅ | ✅ | 🟡 *technically allowed* | Only checks that an assignment exists, not its role (see below) |

## How the owner-only actions are enforced

Owner-only Server Actions all follow the same pattern: look up the caller's `ProjectAssignment`, and throw if `role !== 'owner'`. For example, `deleteProject` throws `Only project owners can delete the project`, `shareProject` throws `Only owner can share`, and so on — see [Server Actions](./server-actions) for the exact error messages per action. These checks run on the server, so they cannot be bypassed from the client.

### Leaving a project

`leaveProject` behaves differently depending on the caller's role:

- **Owner, sole member:** the project is deleted outright.
- **Owner, other members present:** the action throws, asking the owner to transfer ownership first.
- **Editor or viewer:** their assignment is simply removed.

## Viewer write access is not enforced server-side

:::warning

The distinction between `editor` and `viewer` for **editing** is currently a **client-side convention**, not a server-side guarantee:

- [`saveProjectData`](./server-actions#saveprojectdataprojectid-content-filetree) and [`POST /api/projects/save`](./api-endpoints#post-apiprojectssave) only check that a `ProjectAssignment` exists (any role) — neither excludes `viewer`. `/api/projects/save` doesn't even check for an assignment at all, only that the caller is authenticated.
- [`POST /api/projects/compile`](./api-endpoints#post-apiprojectscompile) performs no access check whatsoever, for any role.
- The Socket.io [`join-document`](./collaboration#connecting-and-joining-a-document) handshake fetches the caller's `role` from `ProjectAssignment`, but only uses it to resolve the display email — every subsequent real-time event (`edit-file`, `create-node`, etc.) is relayed as soon as `session.authorized` is `true`, regardless of role.

In practice, the **editor UI** is what prevents a viewer from editing: `Toolbar.jsx` derives a `canEdit` flag from [`getProjectAssignmentRole`](./server-actions#getprojectassignmentroleprojectid) and disables Save, Open, and text formatting when the role is `viewer`. A viewer who called these Server Actions or emitted these socket events directly (bypassing the UI) would currently succeed. This is a known gap to close — see [Troubleshooting](../troubleshooting) for related notes, or the project's issue tracker.

:::

## Where roles are checked, at a glance

| Layer | Role-aware? |
| --- | --- |
| Server Actions (`actions.ts`) | ✅ for ownership actions (delete, share, archive, remove user, transfer) |
| `/api/projects/save` | ❌ — authentication only, no assignment or role check |
| `/api/projects/compile` | ❌ — no authentication or role check |
| Socket.io (`socketServer.ts`) | ❌ — checks that an assignment exists, ignores its role |
| Editor UI (`Toolbar.jsx`, etc.) | ✅ — hides/disables editing controls for `viewer` |