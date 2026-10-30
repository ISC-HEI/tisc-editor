import path from 'path';

/** Raw diagnostic as returned by `NodeCompiler.fetchDiagnostics`. */
interface RawDiagnostic {
  message?: string;
  package?: string;
  path?: string;
  range?: {
    start?: { line?: number; character?: number };
  } | null;
  severity?: number;
}

export interface DiagnosticLog {
  type: 'error' | 'warning';
  msg: string;
  time: string;
}

export interface DiagnosticContext {
  workingDir: string;
  absoluteMainPath: string;
  /** Maps a line index of the compiled main file to its original line index. */
  mainLineMap?: number[];
}

// LSP-style severities used by typst.ts.
const SEVERITY_ERROR = 1;
const SEVERITY_WARNING = 2;

/**
 * Replaces absolute temporary paths with project-relative ones.
 */
export function cleanPaths(text: string, workingDir: string) {
  return text
    .split(workingDir + path.sep)
    .join('')
    .split(workingDir)
    .join('root');
}

/**
 * Converts raw compiler diagnostics into log entries, prefixing each message
 * with its location (`file:line:column`) when the compiler provides it.
 */
export function formatDiagnostics(raw: unknown, ctx: DiagnosticContext): DiagnosticLog[] {
  if (!Array.isArray(raw)) return [];

  const time = new Date().toLocaleTimeString();

  return (raw as RawDiagnostic[])
    .filter((d) => d?.severity === SEVERITY_ERROR || d?.severity === SEVERITY_WARNING)
    .map((d) => {
      const message = cleanPaths(String(d.message ?? ''), ctx.workingDir) || 'Unknown error';
      const absPath = d.path || '';

      let file = '';
      if (d.package) {
        file = `${d.package}/${absPath.replace(/^[/\\]+/, '')}`;
      } else if (absPath) {
        file = path.relative(ctx.workingDir, absPath).split(path.sep).join('/');
      }

      let location = file;
      const start = d.range?.start;
      if (typeof start?.line === 'number') {
        const isMain = !d.package && absPath === ctx.absoluteMainPath;
        const line =
          isMain && ctx.mainLineMap ? (ctx.mainLineMap[start.line] ?? start.line) : start.line;
        location += `:${line + 1}`;
        if (typeof start.character === 'number') location += `:${start.character + 1}`;
      }

      return {
        type: d.severity === SEVERITY_ERROR ? 'error' : 'warning',
        msg: location ? `${location}: ${message}` : message,
        time,
      };
    });
}
