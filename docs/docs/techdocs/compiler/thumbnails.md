# Project Thumbnails

When the request includes a `projectId` and the format is SVG, a thumbnail is generated **after** the response is sent, using Next.js `after()`. It does not delay the compile response.

## Steps

1. Read `projectThumbnail.updatedAt` for the project (Prisma).
2. If the thumbnail is newer than **120 seconds** (`THROTTLE_MS = 120_000`), stop.
3. Convert the compiled SVG to a PNG 400 px wide with `sharp`.
4. `upsert` the PNG bytes into `projectThumbnail`.

## Error handling

Any error is caught and logged with `console.warn`. Thumbnail failures never affect the compile result.

## Notes

- The thumbnail is built from the SVG output, so it reflects whatever the compiler rendered (including all pages in a single SVG, depending on the compiler version).
- With `sync: true`, markers are invisible metadata and do not alter the rendering.
