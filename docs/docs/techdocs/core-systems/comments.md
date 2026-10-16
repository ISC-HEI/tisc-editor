# Comments

Members can leave review comments on the preview, similar to comments in an online word processor. A right-click on the preview opens an **Add comment** menu, the comment is shown as a pin on the page and in a side panel, and other members see it in real time.

| Piece | File |
| --- | --- |
| Data model | `Comment` in `prisma/schema.prisma` (see [Database Schema](../architecture/database#comment)) |
| Server Actions | `src/lib/actions/comments.ts` (see [Server Actions](./server-actions#comments)) |
| Shared anchor logic and role lists | `src/lib/comment-anchors.ts` |
| Client store, pins, anchoring | `src/hooks/useComments.js` |
| UI | `src/components/Editor/CommentsPanel.jsx`, `PreviewPane.jsx` |

## Permissions

| Action | Owner | Editor | Commenter | Viewer |
| --- | :---: | :---: | :---: | :---: |
| Read comments | ✅ | ✅ | ✅ | ✅ |
| Start a thread / reply | ✅ | ✅ | ✅ | ❌ |
| Resolve / reopen a thread | ✅ | own | own | own |
| Delete a comment | ✅ | own | own | own |

`commenter` is a read-only role that can comment: it cannot save, edit in real time or change tags (see [Roles & Permissions](./role-permissions)). "Own" covers an author whose role was later downgraded. Every check runs on the server; the UI only hides the controls.

## Anchoring

The preview is an SVG rebuilt on every compilation, so a fixed `(page, x, y)` would drift as soon as text is added above the comment. Comments are therefore anchored to the **source**, using the [sync markers](../compiler/sync-markers) (one per paragraph of the main file, with its rendered `page, x, y`).

### Creating the anchor

On right-click, `anchorFromClientPoint`:

1. converts the click into page coordinates (pt) with the inverse of the page group's `getScreenCTM()`, so zoom and page gaps are taken into account;
2. picks the closest marker **above** the click: on the same page first, otherwise the last marker of a previous page;
3. stores `{ filePath, line, pageOffset, x, dy }`:
   - same page: `pageOffset = 0` and `dy = click.y - marker.y`;
   - previous page: `pageOffset = click.page - marker.page` and `dy` is the absolute y on the page.

If there is no marker above, the first marker below on the same page is used (negative `dy`). If the page has no marker at all, `line` is `null` and the position is absolute (`pageOffset` = page, `dy` = y).

### Placing the pins

After each compilation `setPageContent` dispatches `tisc:preview-rendered`. `renderCommentPins` then resolves every open thread with `resolveAnchor` and appends a pin (`g.tisc-comment-pin`) to the matching `g.typst-page`. Pins are part of the SVG, so they follow zoom and scroll for free.

- If the marker of `line` still exists, the stored offset is applied.
- If that paragraph was removed, the pin falls back to the closest paragraph above.
- If `filePath` is no longer the main file, the thread is listed as **Not visible in preview**.

### Following edits

Line numbers change when lines are inserted or removed above a comment. `toLineChanges` keeps the Monaco changes that change the line count, and `shiftLine` moves the anchors:

| Change | Anchor at line `L` |
| --- | --- |
| Entirely above `L` | Shifted by the number of added/removed lines |
| Removed range contains `L` | Collapses onto the last line of the new text |
| New lines inserted at column 1 of `L` | Pushed down with its paragraph |
| Below `L`, or same-line typing | Unchanged |

The same pure function runs on both sides:

- **The client that makes the edit** updates its local threads and sends the changes to `shiftCommentAnchors` (debounced 800 ms, batches of up to 500 changes). Only `owner` and `editor` persist shifts. The server locks the rows (`SELECT … FOR UPDATE`) so concurrent editors apply their shifts one after another.
- **Other clients** apply the shift locally when they receive `remote-edit`, without persisting it.

## Real-time updates

Comments are written through Server Actions only. After a successful action the client emits `comments-changed` on the socket; the server relays it to the room and the other members reload with `listComments`. A forged event can only trigger a reload, never a write.

## Notifications

When someone replies, the thread author receives an email (label `COMMENT`), unless they wrote the reply or have left the project. See [Emails](./emails#emails-sent-by-the-app).

## Known limitations

- Anchors refer to lines of the **main file**. Content coming from an `#include` is anchored to the `#include` line plus an offset, which can drift when the included file changes.
- Edits made while the socket is disconnected are saved, but their line shifts are not persisted.
- Two members commenting and inserting lines above the same spot at the same moment can leave a pin one paragraph off.
- Changing the main file hides pins of comments anchored in the previous main file (they stay in the panel).
