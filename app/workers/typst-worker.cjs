/* eslint-disable @typescript-eslint/no-require-imports */
// Child process that runs Typst compilations on behalf of the compile route.
// The native compiler leaks memory, so this process is periodically recycled
// by src/lib/typst-pool.ts: when it exits, the OS reclaims everything.
const { NodeCompiler } = require('@myriaddreamin/typst-ts-node-compiler');

// Exit with the parent instead of lingering as an orphan.
process.on('disconnect', () => process.exit(0));

process.on('message', ({ id, workingDir, mainFilePath, format, sync }) => {
  let result;
  try {
    const compiler = NodeCompiler.create({
      workspace: workingDir,
      inputs: { X: 'u' },
      fontArgs: [{ fontPaths: ['/usr/local/share/fonts'] }],
    });
    const compiled = compiler.compile({ mainFilePath });
    const document = compiled.result;

    if (compiled.hasError() || !document) {
      const d = compiled.takeDiagnostics() ?? compiled.takeError();
      let diagnostics = null;
      if (d) {
        try {
          diagnostics = compiler.fetchDiagnostics(d);
        } catch {
          diagnostics = d.shortDiagnostics;
        }
      }
      result = { ok: false, diagnostics };
    } else if (format === 'pdf') {
      result = { ok: true, format: 'pdf', pdf: compiler.pdf(document) };
    } else {
      const svg = compiler.svg(document);
      let syncRaw = null;
      if (sync) {
        try {
          syncRaw = compiler.query(document, { selector: '<tsync-marker>' });
        } catch (e) {
          const errorMsg = typeof e === 'string' ? e : e?.message || e?.code || 'Compilation error';
          console.warn('Sync marker query failed (non-fatal):', errorMsg);
        }
      }
      result = { ok: true, format: 'svg', svg, syncRaw };
    }
  } catch (e) {
    const message =
      typeof e === 'string'
        ? e
        : e?.message || e?.code || 'Compilation failed for an unknown reason.';
    result = { ok: false, message: String(message) };
  }
  result.rss = process.memoryUsage().rss;
  process.send({ id, result });
});
