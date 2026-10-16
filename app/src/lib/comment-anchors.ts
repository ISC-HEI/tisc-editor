/**
 * Pure helpers shared by the client and the server to keep comment anchors
 * (0-based source lines) in sync with edits made in Monaco.
 */

export const COMMENT_ROLES = ['owner', 'editor', 'commenter'];
export const EDIT_ROLES = ['owner', 'editor'];
export const SHARE_ROLES = ['viewer', 'commenter', 'editor'];

export const MAX_COMMENT_LENGTH = 2000;

/** A Monaco change reduced to what matters for line shifting (1-based lines). */
export interface LineChange {
  start: number;
  end: number;
  startColumn: number;
  added: number;
}

interface MonacoLikeChange {
  range: { startLineNumber: number; endLineNumber: number; startColumn: number };
  text: string;
}

/**
 * Keeps only the Monaco changes that add or remove lines.
 */
export function toLineChanges(changes: MonacoLikeChange[]): LineChange[] {
  if (!Array.isArray(changes)) return [];
  return changes
    .map((c) => ({
      start: c.range.startLineNumber,
      end: c.range.endLineNumber,
      startColumn: c.range.startColumn,
      added: (c.text.match(/\n/g) || []).length,
    }))
    .filter((c) => c.added !== c.end - c.start);
}

/**
 * Returns the new 0-based line of an anchor after a single change.
 * Anchors inside a removed range collapse onto the last line of the new text.
 * Inserting lines at column 1 of the anchored line pushes the anchor down
 * with its paragraph.
 */
export function shiftLine(line: number, change: LineChange): number {
  const s = change.start - 1;
  const e = change.end - 1;
  const delta = change.added - (e - s);

  if (delta === 0) return line;
  if (line > e) return line + delta;
  if (line > s) return Math.min(line, s + change.added);
  if (line === s && e === s && change.startColumn === 1) return line + delta;
  return line;
}

/** Applies changes in order, the same way Monaco reports them. */
export function applyLineChanges(line: number, changes: LineChange[]): number {
  return changes.reduce((current, change) => shiftLine(current, change), line);
}

/**
 * Validates untrusted line changes (server side). Returns null if malformed.
 */
export function parseLineChanges(input: unknown, max = 500): LineChange[] | null {
  if (!Array.isArray(input) || input.length > max) return null;

  const isInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;
  const result: LineChange[] = [];

  for (const raw of input) {
    const c = raw as Partial<LineChange>;
    if (!isInt(c?.start) || !isInt(c.end) || !isInt(c.startColumn) || !isInt(c.added)) {
      return null;
    }
    if (c.start < 1 || c.end < c.start) return null;
    result.push({ start: c.start, end: c.end, startColumn: c.startColumn, added: c.added });
  }

  return result;
}

export function normalizeFilePath(path: string) {
  return String(path ?? '').replace(/^root\//, '');
}
