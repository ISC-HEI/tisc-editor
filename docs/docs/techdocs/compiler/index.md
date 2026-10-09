# Typst Compiler

Typst documents are compiled **server-side** in a Next.js API route (`POST`). The client sends the project file tree; the server writes it to a temporary directory, compiles it with the Typst engine, returns the result (SVG or PDF), then cleans up.

## Quick facts

| Item | Value |
|---|---|
| Library | `@myriaddreamin/typst-ts-node-compiler` (Node bindings of typst.ts) |
| Version in use | **^0.7.0-rc2** |
| Used in | The compile route only (`NodeCompiler.create(...)`) |
| Fonts | `/usr/local/share/fonts` (must exist on the server / in the Docker image) |
| Output formats | `svg` (default, used for the preview) or `pdf` (export) |

## Pages in this section

- [API reference](./api.md): request, responses, error handling
- [File handling](./file-handling.md): temp directories, size limits, cleanup
- [Sync markers](./sync-markers.md): editor ↔ preview synchronization
- [Project thumbnails](./thumbnails.md): background thumbnail generation

## High-level flow

1. Create an isolated session directory: `os.tmpdir()/typst-<random hex>`.
2. If `sync` is enabled (SVG only), inject sync markers into the main file **in memory**.
3. Write the file tree to disk (with size checks).
4. Create a `NodeCompiler` scoped to that directory.
5. Compile to SVG or PDF; for SVG with `sync`, query the markers.
6. Optionally schedule thumbnail generation (non-blocking).
7. Always clean up temporary files in a `finally` block.

> A new compiler instance is created on **every request**. This is simple and isolated, but there is no caching or incremental compilation.
