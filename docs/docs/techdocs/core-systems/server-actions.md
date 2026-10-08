# Server Actions

The dashboard's business logic does not go through the [API routes](./api-endpoints) but through **Next.js Server Actions**. They are marked with the `'use server'` directive and split across several files under `src/app/dashboard/actions/`, grouped by domain:

| File | Contains |
| --- | --- |
| `admin.ts` | Admin-only user management (disable accounts, storage quotas, user listing) |
| `projects.ts` | Project CRUD, loading, saving, archiving |
| `tags.ts` | Tag management |
| `sharing.ts` | Sharing, ownership transfer, member management |
| `access-requests.ts` | Access requests: asking a project owner for access, and answering the requests |
| `storage.ts` | Storage quota usage |
| `github-import.ts` | Template fetching/importing from GitHub (see [Template Management](./templates)) |
| `auth.ts` | Sign-out |
| `utils.ts` | Shared internal helpers used by the files above (not exported to components) |

Unlike the API routes, these functions are called directly from React components (as regular async functions, or bound to a `<form action={...}>`), without an explicit HTTP layer. Next.js handles the serialization for you.

:::info[Common pattern]

Almost every action follows the same shape, backed by shared helpers in `utils.ts`:

1. Read the session and resolve the caller's user ID via `requireUserId()`. If there is no session, it throws `Unauthorized` (or a custom message, e.g. `No authorization`, when the caller passes one).
2. Look up the caller's `ProjectAssignment` for the target project via `getAssignment()` / `requireAssignment()` to check **that they have access at all**. Owner-only actions additionally check `role === 'owner'` (either inline, or via `requireOwnerAssignment()` for the handful of actions — `shareProject`, `transferProjectOwnership`, `removeSharedUser`, `resolveAccessRequest` — that use a single "not owner" error regardless of whether the caller has no assignment at all or just isn't the owner).
3. Perform the Prisma read/write (occasionally wrapped in `prisma.$transaction`).
4. Call `revalidatePath('/dashboard')` so the dashboard's server-rendered data is refreshed on the next navigation.

Individual sections below only call out what differs from this pattern.

:::

:::info[Emails]

Some actions send an email with `sendMail` after the database change has succeeded (`shareProject`, `transferProjectOwnership`, `requestProjectAccess`, `resolveAccessRequest`). A sending failure never makes the action fail: `sendMail` catches its own errors and the actions do not check its result. See [Emails](./emails#error-handling).

:::

## Admin

*Defined in `admin.ts`.*

:::info[Differs from the common pattern]

Admin actions do not use `requireUserId()` or `ProjectAssignment`. Instead they rely on two helpers from `utils.ts`:

- `requireAdmin()` verifies that the caller is an administrator and returns the admin user. It throws otherwise.
- `requireUser(userId)` verifies that the target user exists. It throws otherwise.

They also revalidate `/admin` instead of `/dashboard`.

:::

### `setUserDisabled(userId, disabled)`

Enables or disables a user account by setting `User.disabled`.

**Auth:** admin only.

**Validation:** an admin cannot disable their own account, otherwise `You can't disable your own account`.

### `updateUserQuota(userId, quota)`

Updates a user's storage quota (`User.storageQuota`, see [Database Schema](../architecture/database)).

**Auth:** admin only.

**Validation:** `quota` must be a finite number between `0` and `2,147,483,647` (the maximum 32-bit signed integer, matching the column type), otherwise `Invalid quota`.

### `getAllUsers()`

Returns every user, used to populate the admin user table.

**Auth:** admin only.

**Returns** an array of users with the following fields: `id`, `name`, `email`, `disabled`, `storageQuota`, `createdAt`.

---


## Projects

*Defined in `projects.ts`.*

### `getUserProjects()`

Returns every project the current user has access to (owned or shared), with enough data to render the dashboard cards.

**Auth:** required.

**Returns** an array of projects, each augmented with:

| Field | Description |
| --- | --- |
| `isAuthor` | `true` if the caller's role on this project is `owner` |
| `role` | The caller's role: `owner`, `editor` or `viewer` |
| `hasThumbnail` | Whether a `ProjectThumbnail` exists (the raw image is fetched separately via [`GET /api/projects/[id]/thumbnail`](./api-endpoints#get-apiprojectsidthumbnail)) |
| `ownerName` | Display name of the project's owner |
| `tags` | The project's `Tag` records |
| `usersSharing` | IDs of the other users who have access to the project |

### `getProjectAssignmentRole(projectId)`

Returns the caller's role (`'owner' | 'editor' | 'viewer'`) on a project, or `null` if they have no assignment. Used by client components to decide what UI to show (e.g. hiding owner-only actions) without re-fetching the whole project.

The editor page also relies on it: when it returns `null`, the page displays the [access request](./access-requests#editor-page) screen instead of the editor. It must therefore return `null`, not throw, when there is no assignment.

**Auth:** required.

### `createProject(formData)`

Creates a new project, optionally from a [template](./templates), and assigns the caller as `owner`.

**Auth:** required (`No authorization` if missing).

**Form fields**

| Field | Type | Description |
| --- | --- | --- |
| `title` | `string` | Project title (required) |
| `packageBase` | `string` | Template identifier, or `'blank'` for an empty project (required) |
| `packageSubPath` | `string` | Optional subfolder inside the template package |
| `entryFile` | `string` | The template's entry file, used to build `main.typ` |
| `tags` | `string[]` | Tags to attach at creation time (deduplicated and lowercased) |

**Validation**

- `title` and `packageBase` are required, otherwise `Missing project information`.
- At most **10** tags, otherwise `Maximum 10 tags allowed`.
- Each tag must be **50 characters or fewer**, otherwise `Tags must be 50 characters or fewer`.

**How it works**

1. If `packageBase` is `'blank'`, the file tree is just an empty `main.typ`. Otherwise, the template is resolved and downloaded from GitHub via `getLatestVersion` and `importPackageAsTree`, imported from `github-import.ts` — see [Template Management](./templates) for the full fetch/import flow.
2. The resulting file tree's size is checked against the caller's storage quota (`checkUserQuota`, see [Database Schema](../architecture/database)). If it would be exceeded, the action throws `Quota exceeded (X MB / Y MB). Cannot create project.` **before** any database write.
3. The `Project`, its owner `ProjectAssignment`, and its tags (created via `upsert` so existing tags are reused) are all written inside a single `prisma.$transaction`.

**Returns** the created `Project` record.

### `loadProject(id)`

Loads a single project (with its tags) for the caller, used when opening a project from the dashboard. Delegates to an internal (non-exported) `getProjectById` helper.

**Auth:** required.

**Returns** the `Project` record with `tags` resolved to `Tag[]`, or `null` if the caller has no `ProjectAssignment` for it (i.e. no access, rather than a thrown error).

### `setProjectActiveStatus(projectId, isActive)`

Sets `Project.isActive`, the mechanism behind [archiving / unarchiving](../../tutorial/projects/archive) a project.

**Auth:** required. The caller must be the `owner`, otherwise `Only project owners can change the active status`.

### `leaveProject(formData)`

Removes the caller's `ProjectAssignment` from a project.

**Auth:** required.

**Form fields:** `id` — the project ID.

**Behavior depends on the caller's role:**

- **Owner, sole member** (`membersCount === 1`): the project is deleted outright, same effect as `deleteProject`. Returns `{ action: 'deleted' }`.
- **Owner, other members present**: the action throws — an owner must transfer ownership (see [`transferProjectOwnership`](#transferprojectownershipprojectid-newowneremail)) before they can leave.
- **Editor / viewer**: their assignment is simply deleted. Returns `{ action: 'left' }`.

### `deleteProject(formData)`

Permanently deletes a project and all its related data (assignments, tags, thumbnail, access requests — all cascade on `Project` deletion, see [Database Schema](../architecture/database)).

**Auth:** required. Only the `owner` may delete a project, otherwise `Only project owners can delete the project`.

**Form fields:** `id` — the project ID.

**Returns** `{ action: 'deleted' }`.

:::warning[Irreversible]

There is no soft-delete or trash for this action — unlike [archiving](../../tutorial/projects/archive), a deleted project cannot be recovered. Archiving only flips `Project.isActive`; this action removes the row entirely.

:::

### `duplicateProject(formData)`

Creates an independent copy of a project. The caller becomes the `owner` of the copy, whatever their role on the source project.

**Auth:** required. The caller must have a `ProjectAssignment` on the source project (any role: `owner`, `editor` or `viewer`), otherwise `You do not have access to this project`.

**Form fields**

| Field | Type | Description |
| --- | --- | --- |
| `id` | `string` | ID of the project to duplicate (required) |

**Validation**

- `id` is required, otherwise `Missing project id`.
- The source project must exist, otherwise `Project not found`.

**How it works**

1. The source project is loaded with its tags.
2. The size of its file tree is checked against the caller's storage quota (`checkUserQuota`, see [Database Schema](../architecture/database)). If it would be exceeded, the action throws `Quota exceeded (X MB / Y MB). Cannot duplicate project.` **before** any database write. The copy is owned by the caller, so it counts toward their quota even if the source belongs to someone else.
3. The new `Project` and its owner `ProjectAssignment` are written inside a single `prisma.$transaction`:
   - the title is the source title suffixed with ` (copy)`;
   - the file tree is copied as is;
   - `isActive` is set to `true`, so the copy of an archived project appears in the active list;
   - the source project's tags are attached to the copy (existing `Tag` records are reused, none are created).

**What is not copied**

| Data | Why |
| --- | --- |
| Members (`ProjectAssignment`) | The copy is private to the caller; share it explicitly with [`shareProject`](#shareprojectprojectid-shareduseremail-canedit--false) |
| Access requests | They belong to the source project |
| Thumbnail (`ProjectThumbnail`) | Regenerated the next time the copy is saved |

**Returns** `{ success: true, id: string }`, where `id` is the ID of the new project.

:::info[Not restricted to owners]

Unlike [`deleteProject`](#deleteprojectformdata) or [`setProjectActiveStatus`](#setprojectactivestatusprojectid-isactive), duplication is open to every member, including viewers. Anyone who can read the project can already export its content, and the copy is entirely independent of the original.

:::

---

## Storage

*Defined in `storage.ts`.*

### `getUserStorage()`

Computes the caller's current storage usage against their quota, used by the dashboard's storage bar.

**Auth:** required.

**Returns** `{ usage, limit, percentage } | null` (`null` if the user record can't be found). `usage` is computed from the file trees of projects the caller **owns** — projects shared with them do not count, matching the [Database Schema](../architecture/database) notes on `storageQuota`.

---

## Tags

*Defined in `tags.ts`.*

### `addTagToProject(projectId, tag)`

Attaches a tag to a project, creating the `Tag` record first if it doesn't already exist (`upsert`).

**Auth:** required. The caller must have a `ProjectAssignment` on the project (any role), otherwise `Access denied`.

### `getProjectTags(projectId)`

Returns both the tags currently on a project and the full list of tags available platform-wide, so the "Edit Tags" UI can offer autocomplete.

**Auth:** required. The caller must have a `ProjectAssignment` on the project, otherwise `Access denied`.

**Returns** `{ projectTags: Tag[], availableTags: Tag[] }`.

### `getTagsByUser()`

Returns every distinct tag used across all projects the caller has access to, sorted alphabetically. Used to power tag-filter suggestions on the dashboard.

**Auth:** required.

### `removeTagFromProject(projectId, tag)`

Detaches a tag from a project. If the tag ends up attached to **zero** projects afterwards, the `Tag` record itself is deleted, keeping the global tag list clean.

**Auth:** required. Same access check as `addTagToProject`.

---

## Sharing & Ownership

*Defined in `sharing.ts`.* See [Sharing a project](../../tutorial/projects/sharing) for the user-facing flow these actions implement.

### `shareProject(projectId, sharedUserEmail, canEdit = false)`

Grants another user access to a project by creating a `ProjectAssignment` for them.

**Auth:** required. Only the `owner` may share, otherwise `Only owner can share`.

**Returns** either `{ success: true }` or `{ error: string }` (not thrown) for the expected failure cases:

| Condition | Error |
| --- | --- |
| No user with `sharedUserEmail` exists | `User not found` |
| The target is the caller themselves | `You already have access to this project` |
| The target already has a `ProjectAssignment` | `The user already has access to this project` |

The new assignment's role is `editor` if `canEdit` is `true`, otherwise `viewer`.

**Email:** once the assignment is created, the shared user receives an email (label `SHARING`) naming the project and the person who shared it, with a button to the dashboard. See [Emails](./emails#emails-sent-by-the-app).

### `getProjectMembers(projectId)`

Returns every member of a project, but **excludes the caller** from the result. Used to populate pickers such as the "transfer ownership to…" selector.

**Auth:** required.

### `getUsersEmailFromId(usersId)`

Resolves a list of user IDs to their `{ id, email }`. Used on the client to display emails for users already known by ID (e.g. the collaboration presence list).

**Auth:** none — this action does not call `auth()`.

### `transferProjectOwnership(projectId, newOwnerEmail)`

Swaps the `owner` role between the caller and another existing member.

**Auth:** required. Only the current `owner` may transfer, otherwise `Only the owner can transfer ownership`.

**Preconditions:**

- `newOwnerEmail` must belong to an existing user, otherwise `User not found`.
- That user must **already** have a `ProjectAssignment` on the project (i.e. the project must already be shared with them), otherwise the action throws asking to share the project with them first.

**How it works:** both role updates (new owner → `owner`, caller → `editor`) happen inside a single `prisma.$transaction`, so the project is never left without an owner.

**Email:** once the transfer is done, the new owner receives an email (label `OWNERSHIP`) naming the project, with a button to the dashboard. See [Emails](./emails#emails-sent-by-the-app).

### `removeSharedUser(projectId, sharedUserEmail)`

Revokes another user's access by deleting their `ProjectAssignment`.

**Auth:** required. Only the `owner` may remove users, otherwise `Only owner can remove users`. An owner cannot remove themselves this way (`Owner cannot remove themselves`) — see `leaveProject` or `transferProjectOwnership` instead.

No email is sent to the removed user.

---

## Access requests

*Defined in `access-requests.ts`.* These actions let a user without access ask the project owner for it, and let the owner answer. See [Access Requests](./access-requests) for the full flow, and [Requesting access to a project](../../tutorial/projects/request-access.md) for the user-facing guide.

:::info[Differs from the common pattern]

- `requestProjectAccess` is the only project-related action that is meant to be called by a user who has **no** `ProjectAssignment` on the project.
- Expected failures of `requestProjectAccess` are **returned** as `{ error }` rather than thrown, because the action is used with `useActionState`.
- `resolveAccessRequest` revalidates `/access-requests/<id>` instead of `/dashboard`.

:::

### `requestProjectAccess(prevState, formData)`

Creates or renews an access request for a project the caller is not assigned to, then emails the project owner with a link to the review page. It is meant to be used with `useActionState` in the `RequestAccess` component.

**Auth:** required (any signed-in user).

| Parameter | Type | Description |
| --- | --- | --- |
| `prevState` | `{ success?: boolean; error?: string }` | Previous state, provided by `useActionState`. Unused |
| `formData` | `FormData` | Must contain a `projectId` field |

**Returns** `{ success?: boolean; error?: string }`.

| Condition | Result |
| --- | --- |
| `projectId` is not a valid UUID | `error: 'Invalid project'` |
| The project does not exist | `success: true`, nothing is created or sent (so the response does not reveal which projects exist) |
| The caller already has a `ProjectAssignment` | `error: 'You already have access to this project'` |
| The previous request was denied | `error: 'Your previous request was declined by the owner'` |
| A pending request was made less than 24 h ago | `error: 'You already requested access. The owner has been notified.'` |
| Otherwise | The request is created (or reset to `pending`), an email is sent to the owner, `success: true` |

**How it works:** the request is stored with an `upsert` on the `[userId, projectId]` unique key, so there is at most one row per user and project. A pending request older than 24 h, or an approved one whose assignment was later removed, is reset to `pending` and the owner is notified again.

**Email:** the project owner receives an email (label `ACCESS REQUEST`) with a **Review request** button to `/access-requests/<id>`. See [Emails](./emails#emails-sent-by-the-app).

### `resolveAccessRequest(requestId, decision)`

Approves or denies an access request. When approved, the requester is assigned to the project with the chosen role.

**Auth:** required. Only the `owner` of the project may answer, otherwise `Only the owner can handle access requests`.

| Parameter | Type | Description |
| --- | --- | --- |
| `requestId` | `string` | UUID of the `AccessRequest` |
| `decision` | `'viewer' \| 'editor' \| 'deny'` | Role to grant, or `'deny'` to refuse the request |

**Returns** `Promise<void>`. The review page is revalidated so it displays the new status.

**Errors thrown:**

| Error | Cause |
| --- | --- |
| `Invalid request` | `requestId` is not a UUID, or `decision` is not one of the three allowed values |
| `Request not found` | No request with this id |
| `Only the owner can handle access requests` | The caller is not the owner of the request's project |
| `This request has already been handled` | The request is no longer `pending` |

**How it works:**

| Decision | Effect |
| --- | --- |
| `'deny'` | `status = 'denied'` and `resolvedAt` is set. No email is sent |
| `'viewer'` / `'editor'` | In a single `prisma.$transaction`: upserts the `ProjectAssignment` with this role (an existing assignment is left unchanged) and sets `status = 'approved'`. Then the requester is emailed |

**Email:** on approval, the requester receives an email (label `ACCESS GRANTED`) with a button to open the project. See [Emails](./emails#emails-sent-by-the-app).

:::warning[Called from the client]

Server Actions are public endpoints and can be called directly, bypassing the review page. For this reason `resolveAccessRequest` validates its arguments and checks ownership itself instead of relying on the page.

:::

---

## Authentication

*Defined in `auth.ts`.*

### `handleSignOut()`

Signs the caller out and redirects them through Keycloak's end-session endpoint so the SSO session is terminated too, not just the local Next.js session.

**How it works:**

1. Calls NextAuth's `signOut({ redirect: false })` to clear the local session without letting NextAuth perform its own redirect.
2. Builds a Keycloak logout URL from `AUTH_KEYCLOAK_ISSUER`, `AUTH_KEYCLOAK_ID` and `AUTH_URL` (used as the post-logout redirect target).
3. Redirects the browser to that URL.

This is what powers the logout button described in [Login](../../tutorial/login#logout).