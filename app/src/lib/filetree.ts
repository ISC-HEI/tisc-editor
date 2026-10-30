/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import type { Prisma } from '@prisma/client';
import { FileNode } from '@/types/filetree';

type FolderNode = Extract<FileNode, { type: 'folder' }>;

function asString(value: Prisma.JsonValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Converts a raw JSON file tree into a well-formed FileNode tree.
 */
export function normalizeFileTree(value: Prisma.JsonValue): FileNode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { type: 'folder', name: 'root', children: {} };
  }

  const obj = value as Prisma.JsonObject;

  if (obj.type === 'file') {
    return {
      type: 'file',
      name: asString(obj.name),
      fullPath: asString(obj.fullPath, asString(obj.name)),
      data: asString(obj.data),
      content: typeof obj.content === 'string' ? obj.content : undefined,
      isMain: obj.isMain === true,
    };
  }

  const normalizedChildren: Record<string, FileNode> = {};
  const children = obj.children;
  if (children && typeof children === 'object' && !Array.isArray(children)) {
    for (const [key, child] of Object.entries(children as Prisma.JsonObject)) {
      if (child !== undefined) {
        normalizedChildren[key] = normalizeFileTree(child);
      }
    }
  }

  return {
    type: 'folder',
    name: asString(obj.name, 'root'),
    children: normalizedChildren,
  };
}

export type FlatFile = {
  path: string;
  content: string;
  isMain: boolean;
};

/**
 * Flattens a FileNode tree into a list of files (one entry per file, folders are implied by paths).
 */
export function flattenTree(node: FileNode, acc: FlatFile[] = []): FlatFile[] {
  if (node.type === 'file') {
    acc.push({
      path: node.fullPath,
      content: node.data,
      isMain: !!node.isMain,
    });
  } else {
    for (const child of Object.values(node.children)) {
      flattenTree(child, acc);
    }
  }

  return acc;
}

/**
 * Rebuilds the FileNode tree from flat ProjectFile rows, so the rest of the
 * app keeps consuming `fileTree` exactly as before.
 */
export function buildTree(
  files: { path: string; content: Uint8Array | null; isMain: boolean }[],
): FolderNode {
  const root: FolderNode = { type: 'folder', name: 'root', children: {} };

  for (const file of files) {
    const parts = file.path.split('/');
    const fileName = parts[parts.length - 1];

    let current: FolderNode = root;

    for (const part of parts.slice(0, -1)) {
      let next = current.children[part];

      if (!next) {
        next = { type: 'folder', name: part, children: {} };
        current.children[part] = next;
      }

      if (next.type !== 'folder') {
        throw new Error(`Path conflict: "${part}" is both a file and a folder`);
      }

      current = next;
    }

    current.children[fileName] = {
      type: 'file',
      name: fileName,
      fullPath: file.path,
      isMain: file.isMain,
      data: file.content ? Buffer.from(file.content).toString('utf8') : '',
    };
  }

  return root;
}
