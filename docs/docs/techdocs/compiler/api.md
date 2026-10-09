# API Reference

`POST` on the compile route, JSON body.

## Request

| Field | Type | Description |
|---|---|---|
| `fileTree` | `FileTreeNode` | Project tree (`children` hold folders/files; file content is in `data`) |
| `mainFile` | `string` | Entry file, e.g. `root/main.typ` (the `root/` prefix is stripped) |
| `format` | `'svg' \| 'pdf'` | Default: `svg` |
| `sync` | `boolean` | Enables sync markers (ignored for PDF). Default: `false` |
| `projectId` | `string?` | When present, triggers thumbnail generation |

## Compiler configuration

```ts
NodeCompiler.create({
  workspace: workingDir,
  inputs: { X: 'u' },
  fontArgs: [{ fontPaths: ['/usr/local/share/fonts'] }],
});
```

`inputs` is exposed to documents through `sys.inputs`. The current `{ X: 'u' }` value is hard-coded; its purpose should be clarified.

## Responses

### PDF, success

Binary body with `Content-Type: application/pdf`.

### SVG, success (`200`)

```json
{
  "success": true,
  "svg": "<svg ...>",
  "syncMarkers": [{ "line": 12, "page": 1, "x": 72, "y": 140.5 }],
  "logs": [{ "type": "success", "msg": "Compilation successful", "time": "..." }]
}
```

### Typst compilation error (`200`, on purpose)

```json
{
  "success": false,
  "svg": null,
  "syncMarkers": [],
  "logs": [{ "type": "error", "msg": "...", "time": "..." }]
}
```

The temporary directory path is replaced with `root` in the message so the server's file layout is not exposed.

### Request / I/O error (`400`)

```json
{ "success": false, "logs": [{ "type": "error", "msg": "..." }] }
```

Typical causes: invalid JSON, file too large, session quota exceeded.

> Clients must handle both cases: compilation errors come back as `200` with `success: false`, request errors as `400`.
