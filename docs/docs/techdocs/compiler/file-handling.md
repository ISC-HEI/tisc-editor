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

Every file, folder and main-file path is resolved through `safeResolve(workingDir, ...)`, which throws `Invalid file path` if the resolved path is not inside `workingDir` (e.g. names containing `../` or absolute paths). The request then fails with a `400`. The endpoint also requires an authenticated session.
