# Sync Markers

Sync markers link a **source line** in the editor to a **position in the preview** (page, x, y), enabling editor ↔ preview synchronization.

Only active when `sync: true` and `format !== 'pdf'`.

## Injection (`injectSyncMarkers`)

Before each "safe" paragraph start, this line is inserted:

```typst
#context [#metadata((line: <n>, loc: here().position())) <tsync-marker>]
```

- `line` is the 0-based line index in the **original** source, so inserted lines do not shift values.
- A paragraph start is the first non-empty line after an empty line.
- A position is "safe" when all of these hold:
  - bracket depth (`()`, `[]`, `{}`) is 0;
  - not inside a code fence (` ``` `);
  - no math block is open.

The patch is applied in memory by `patchMainFileContent` on the main file only. The persisted and exported content is never modified.

## Retrieval (`parseSyncMarkers`)

```ts
compiler.query(compileOptions, { selector: '<tsync-marker>' })
```

The raw result is converted to `{ line, page, x, y }` where `x` and `y` are numbers in pt (the `pt` suffix is stripped). Malformed entries are dropped; the function never throws.

A failing `query` is **non-fatal**: a warning is logged and `syncMarkers` stays empty, while the SVG is still returned.

## Known limitations

- Bracket counting is naive: strings and comments (`//`, `/* */`) are not handled.
- Math detection uses the parity of unescaped `$` per line.
- Markers are only injected in the main file, not in included files.
- Relies on `here().position()` and `query`. A compiler upgrade may change the shape of `loc` (units, keys) and break `parseSyncMarkers`.
