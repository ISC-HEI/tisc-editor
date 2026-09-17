# Troubleshooting

Common issues encountered while developing on TISC Editor, and how to fix them. This page is filled in progressively as new issues come up.

## Build & TypeScript

### `Parameter 'tx' implicitly has an 'any' type` in a Prisma transaction

**Cause:** TypeScript's `noImplicitAny` flags the callback parameter of `prisma.$transaction(async (tx) => ...)` when it isn't explicitly typed.

**Solution:** Derive the type from the query itself instead of importing `Prisma.TransactionClient` by hand:

```typescript
type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const result = await prisma.$transaction(async (tx: TransactionClient) => {
  // ...
});
```

### `Type 'JsonValue' is not assignable to type '...'`

**Cause:** Any Prisma field typed as `Json` (e.g. `fileTree`) is returned as `Prisma.JsonValue`, not your app-level type (e.g. `FileTreeNode`). This mismatch shows up anywhere that value is passed to a function expecting the narrower type.

**Solution:** Cast at the call site:

```typescript
calcFileTreeSize(project.fileTree as unknown as FileTreeNode);
```


### `bun run build` fails after pulling new changes

**Cause:** The Prisma client wasn't regenerated after a schema change.

**Solution:**

```bash
cd app
bun x prisma generate
```