# Server Actions

Most of the dashboard's business logic does not go through the [API routes](./api-endpoints) but through **Next.js Server Actions**. They all live in `src/app/dashboard/actions.ts` and are marked with the `'use server'` directive.

Unlike the API routes, these functions are called directly from React components (as regular async functions, or bound to a `<form action={...}>`), without an explicit HTTP layer. Next.js handles the serialization for you.

:::info[Common pattern]

Almost every action follows the same shape:

1. Read the session with `auth()`. If there is no `session.user.id`, throw `Unauthorized` (or `No authorization`).
2. Look up the caller's `ProjectAssignment` for the target project to check **that they have access at all**, and sometimes that their `role` is `owner` for owner-only actions.
3. Perform the Prisma read/write (occasionally wrapped in `prisma.$transaction`).
4. Call `revalidatePath('/dashboard')` so the dashboard's server-rendered data is refreshed on the next navigation.

Individual sections below only call out what differs from this pattern.

:::

## Projects

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

**Auth:** required.

### `createProject(formData)`

Creates a new project, optionally from a [template](./templates), and assigns the caller as `owner`.

**Auth:** required.

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

1. If `packageBase` is `'blank'`, the file tree is just an empty `main.typ`. Otherwise, the template is resolved and downloaded from GitHub — see [Template Management](./templates) for the full fetch/import flow.
2. The resulting file tree's size is checked against the caller's storage quota (`checkUserQuota`, see [Database Schema](../architecture/database)). If it would be exceeded, the action throws `Quota exceeded (X MB / Y MB). Cannot create project.` **before** any database write.
3. The `Project`, its owner `ProjectAssignment`, and its tags (created via `upsert` so existing tags are reused) are all written inside a single `prisma.$transaction`.

**Returns** the created `Project` record.

### `deleteProject(formData)`

Permanently deletes a project and all its related data (assignments, tags, thumbnail — all cascade on `Project` deletion, see [Database Schema](../architecture/database)).

**Auth:** required. Only the `owner` may delete a project, otherwise `Only project owners can delete the project`.

**Form fields:** `id` — the project ID.

**Returns** `{ action: 'deleted' }`.

:::warning[Irreversible]

There is no soft-delete or trash for this action — unlike [archiving](../../tutorial/projects/archive), a deleted project cannot be recovered. Archiving only flips `Project.isActive`; this action removes the row entirely.

:::

### `leaveProject(formData)`

Removes the caller's `ProjectAssignment` from a project.

**Auth:** required.

**Form fields:** `id` — the project ID.

**Behavior depends on the caller's role:**

- **Owner, sole member** (`membersCount === 1`): the project is deleted outright, same effect as `deleteProject`. Returns `{ action: 'deleted' }`.
- **Owner, other members present**: the action throws — an owner must transfer ownership (see [`transferProjectOwnership`](#transferprojectownershipprojectid-newowneremail)) before they can leave.
- **Editor / viewer**: their assignment is simply deleted. Returns `{ action: 'left' }`.

### `saveProjectData(projectId, content, fileTree)`

Persists a project's file tree from the dashboard/editor context (distinct from [`POST /api/projects/save`](./api-endpoints#post-apiprojectssave), which is the route used by the editor's autosave and does enforce the quota check on every call).

**Auth:** required. The caller must have a `ProjectAssignment` on the project, otherwise `Access denied`.

**Note:** the `content` parameter is currently unused by the underlying `prisma.project.update` call, which only persists `fileTree`.

### `loadProject(id)`

Loads a single project (with its tags) for the caller, used when opening a project from the dashboard.

**Auth:** required.

**Returns** the `Project` record with `tags` resolved to `Tag[]`, or `null` if the caller has no `ProjectAssignment` for it (i.e. no access, rather than a thrown error).

### `setProjectActiveStatus(projectId, isActive)`

Sets `Project.isActive`, the mechanism behind [archiving / unarchiving](../../tutorial/projects/archive) a project.

**Auth:** required. The caller must be the `owner`, otherwise `Only project owners can change the active status`.

### `getUserStorage()`

Computes the caller's current storage usage against their quota, used by the dashboard's storage bar.

**Auth:** required.

**Returns** `{ usage, limit, percentage } | null` (`null` if the user record can't be found). `usage` is computed from the file trees of projects the caller **owns** — projects shared with them do not count, matching the [Database Schema](../architecture/database) notes on `storageQuota`.

---

## Tags

### `addTagToProject(projectId, tag)`

Attaches a tag to a project, creating the `Tag` record first if it doesn't already exist (`upsert`).

**Auth:** required. The caller must have a `ProjectAssignment` on the project (any role), otherwise `Access denied`.

### `removeTagFromProject(projectId, tag)`

Detaches a tag from a project. If the tag ends up attached to **zero** projects afterwards, the `Tag` record itself is deleted, keeping the global tag list clean.

**Auth:** required. Same access check as `addTagToProject`.

### `getTagsByUser()`

Returns every distinct tag used across all projects the caller has access to, sorted alphabetically. Used to power tag-filter suggestions on the dashboard.

**Auth:** required.

### `getProjectTags(projectId)`

Returns both the tags currently on a project and the full list of tags available platform-wide, so the "Edit Tags" UI can offer autocomplete.

**Auth:** required. The caller must have a `ProjectAssignment` on the project, otherwise `Access denied`.

**Returns** `{ projectTags: Tag[], availableTags: Tag[] }`.

---

## Sharing & Ownership

See [Sharing a project](../../tutorial/projects/sharing) for the user-facing flow these actions implement.

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

### `transferProjectOwnership(projectId, newOwnerEmail)`

Swaps the `owner` role between the caller and another existing member.

**Auth:** required. Only the current `owner` may transfer, otherwise `Only the owner can transfer ownership`.

**Preconditions:**

- `newOwnerEmail` must belong to an existing user, otherwise `User not found`.
- That user must **already** have a `ProjectAssignment` on the project (i.e. the project must already be shared with them), otherwise the action throws asking to share the project with them first.

**How it works:** both role updates (new owner → `owner`, caller → `editor`) happen inside a single `prisma.$transaction`, so the project is never left without an owner.

### `removeSharedUser(projectId, sharedUserEmail)`

Revokes another user's access by deleting their `ProjectAssignment`.

**Auth:** required. Only the `owner` may remove users, otherwise `Only owner can remove users`. An owner cannot remove themselves this way (`Owner cannot remove themselves`) — see `leaveProject` or `transferProjectOwnership` instead.

### `getProjectUsers(projectId)`

Returns every member of a project (including the caller), with their `id`, `email` and `role`. Used to render the full member list in the sharing modal.

**Auth:** required (any authenticated user — this action does not check that the caller belongs to the project).

### `getProjectMembers(projectId)`

Same as `getProjectUsers`, but **excludes the caller** from the result. Used to populate pickers such as the "transfer ownership to…" selector.

**Auth:** required.

### `getUsersEmailFromId(usersId)`

Resolves a list of user IDs to their `{ id, email }`. Used on the client to display emails for users already known by ID (e.g. the collaboration presence list).

**Auth:** none — this action does not call `auth()`.

---

## Authentication

### `handleSignOut()`

Signs the caller out and redirects them through Keycloak's end-session endpoint so the SSO session is terminated too, not just the local Next.js session.

**How it works:**

1. Calls NextAuth's `signOut({ redirect: false })` to clear the local session without letting NextAuth perform its own redirect.
2. Builds a Keycloak logout URL from `AUTH_KEYCLOAK_ISSUER`, `AUTH_KEYCLOAK_ID` and `AUTH_URL` (used as the post-logout redirect target).
3. Redirects the browser to that URL.

This is what powers the logout button described in [Login](../../tutorial/login#logout).