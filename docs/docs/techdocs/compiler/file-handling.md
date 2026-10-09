# File Handling

## Session isolation

Each request gets its own directory: `os.tmpdir()/typst-<8 random bytes, hex>`. Nothing is shared between requests.

## Writing the file tree (`writeImages`)

The tree is walked recursively; folders are created and files written.

- **`.typ` files**: decoded as UTF-8. The `data:text/plain;base64,` prefix is handled by `decodeContent`.
- **Other files** (images, fonts, data): decoded from base64, either a full data URI or raw base64.
- Nodes without `data` are skipped.

## Limits

| Limit | Value |
|---|---|
| Max size per file | 5 MB |
| Max total size per session | 10 MB |

Exceeding either limit throws an error, which results in a `400` response.

## Cleanup (`cleanupTemp`)

Runs in a `finally` block, whatever the outcome:

1. Delete every created file.
2. Delete created directories, deepest first, if empty.
3. Delete the session directory if empty.

## Security note

File paths are built with `path.join(baseDir, node.name || fileName)`, and the main file with `path.resolve(workingDir, mainFileCleanPath)`. Neither is checked to stay inside `workingDir`, so names containing `../` could escape the session directory. Add a check that the resolved path starts with `workingDir`.
