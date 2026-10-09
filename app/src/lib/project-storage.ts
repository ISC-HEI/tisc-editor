import { createHash, randomUUID } from 'crypto';
import { FlatFile } from '@/lib/filetree';
import { putObject, getObject, deleteByPrefix, mapLimit } from '@/lib/storage';

const CONCURRENCY = 8;

export const projectPrefix = (projectId: string) => `projects/${projectId}/`;

export type PreparedFile = {
  id: string;
  path: string;
  isMain: boolean;
  content: Buffer;
  size: number;
  sha256: string;
  storageKey: string;
};

/**
 * Turns flat files into rows ready to be stored: encodes content, computes
 * size and hash, and derives the storage key from the file id.
 * `idByPath` lets an existing file keep its id (and therefore its key).
 */
export function prepareFiles(
  projectId: string,
  flat: FlatFile[],
  idByPath?: Map<string, string>,
): PreparedFile[] {
  return flat.map((file) => {
    const content = Buffer.from(file.content, 'utf8');
    const id = idByPath?.get(file.path) ?? randomUUID();

    return {
      id,
      path: file.path,
      isMain: file.isMain,
      content,
      size: content.byteLength,
      sha256: createHash('sha256').update(content).digest('hex'),
      storageKey: `${projectPrefix(projectId)}${id}`,
    };
  });
}

/**
 * Uploads prepared files to the object store.
 */
export async function uploadFiles(files: PreparedFile[]) {
  await mapLimit(files, CONCURRENCY, (file) => putObject(file.storageKey, file.content));
}

/**
 * Reads the content of ProjectFile rows. Rows not migrated yet (no storageKey)
 * still carry their content in the database. A missing object throws on purpose:
 * returning an empty file could make the next save overwrite real data.
 */
export async function readFileContents(
  files: { content: Uint8Array | null; storageKey: string | null }[],
): Promise<Uint8Array[]> {
  return mapLimit(files, CONCURRENCY, async (file) => {
    if (file.storageKey) return getObject(file.storageKey);
    return file.content ?? new Uint8Array();
  });
}

/**
 * Best-effort removal of every object of a project. Never throws: leftovers
 * are harmless orphans and must not break the user's request.
 */
export async function cleanupProjectObjects(projectId: string) {
  try {
    await deleteByPrefix(projectPrefix(projectId));
  } catch (error) {
    console.error(`Failed to clean objects of project ${projectId}:`, error);
  }
}
