import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';

const MAX_SESSION_SIZE = 10 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

interface FileTreeNode {
  type: 'file' | 'folder';
  name?: string;
  data?: string;
  content?: string;
  children?: Record<string, FileTreeNode>;
}

interface SyncMarker {
  line: number;
  page: number;
  x: number;
  y: number;
}

interface RawSyncMarkerEntry {
  value?: {
    line?: number;
    loc?: {
      page?: number;
      x?: string;
      y?: string;
    };
  };
}

/**
 * Decodes file content, converting Base64 encoded strings into
 * UTF-8 text if a data URI prefix is detected.
 * @param {string} data - The raw file data (potentially base64 encoded).
 * @returns {string} The decoded plain text content.
 */
function decodeContent(data: string) {
  if (data.startsWith('data:text/plain;base64,')) {
    return Buffer.from(data.split(',')[1], 'base64').toString('utf-8');
  }
  return data;
}

/**
 * Inserts invisible position markers at safe top-level paragraph boundaries
 * in a Typst source string, so we can later query their rendered position
 * (page + x + y) and map source lines to preview coordinates for edit-sync.
 *
 * @param {string} content - Original .typ source.
 * @returns {{ content: string, markerCount: number }} Source with injected
 *   markers, and how many were inserted.
 */
function injectSyncMarkers(content: string) {
  const lines = content.split('\n');
  const out: string[] = [];
  let bracketDepth = 0;
  let inCodeFence = false;
  let mathOpen = false;
  let inParagraph = false;
  let markerCount = 0;

  const countBrackets = (line: string) => {
    for (const ch of line) {
      if (ch === '(' || ch === '[' || ch === '{') bracketDepth++;
      else if (ch === ')' || ch === ']' || ch === '}') bracketDepth = Math.max(0, bracketDepth - 1);
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      inCodeFence = !inCodeFence;
      out.push(line);
      countBrackets(line);
      return;
    }

    if (trimmed === '') {
      inParagraph = false;
      out.push(line);
      return;
    }

    const isSafe = bracketDepth === 0 && !inCodeFence && !mathOpen;

    if (!inParagraph && isSafe) {
      out.push(`#context [#metadata((line: ${idx}, loc: here().position())) <tsync-marker>]`);
      markerCount++;
    }
    inParagraph = true;

    out.push(line);
    countBrackets(line);

    const dollarCount = (line.match(/(?<!\\)\$/g) || []).length;
    if (dollarCount % 2 !== 0) mathOpen = !mathOpen;
  });

  return { content: out.join('\n'), markerCount };
}

/**
 * Walks the JSON file tree to find the main file node and replace its
 * text content in place (used to inject sync markers before compilation
 * without touching what gets persisted or exported).
 * @param {any} children - The fileTree's children object.
 * @param {string} mainFileCleanPath - Path relative to root (no "root/" prefix).
 * @param {(text: string) => string} patchFn - Transform applied to the file's decoded text.
 * @returns {boolean} True if the main file was found and patched.
 */
function patchMainFileContent(
  children: Record<string, FileTreeNode> | undefined,
  mainFileCleanPath: string,
  patchFn: (text: string) => string,
): boolean {
  const parts = mainFileCleanPath.split('/');
  let currentChildren = children;
  let node: FileTreeNode | undefined;

  for (const part of parts) {
    if (!currentChildren || !currentChildren[part]) return false;
    node = currentChildren[part];
    currentChildren = node.children;
  }

  if (!node || node.type !== 'file') return false;
  const original = decodeContent(node.data ?? node.content ?? '');
  node.data = patchFn(original);
  return true;
}

/**
 * Recursively traverses the JSON file tree to recreate the folder structure
 * and write files to the server's temporary local storage.
 * @param {any} children - The nested object containing file/folder nodes.
 * @param {string} baseDir - The target destination path on the disk.
 * @param {Object} accumulator - Tracking object to store created paths for cleanup.
 * @returns {Object} An object containing Sets of created file and directory paths.
 */
function writeImages(
  children: Record<string, FileTreeNode> = {},
  baseDir: string,
  accumulator = { files: new Set<string>(), dirs: new Set<string>(), totalSize: 0 },
  options: { documentFontSize?: number } = {},
) {
  for (const fileName in children) {
    const node = children[fileName];
    const currentPath = path.join(baseDir, node.name || fileName);

    if (node.type === 'folder') {
      if (!fs.existsSync(currentPath)) {
        fs.mkdirSync(currentPath, { recursive: true });
        accumulator.dirs.add(currentPath);
      }
      writeImages(node.children, currentPath, accumulator, options);
    } else if (node.type === 'file') {
      if (!node.data) continue;
      try {
        let buffer: Buffer;

        if (fileName.endsWith('.typ')) {
          let textContent = decodeContent(node.data);

          if (fileName.endsWith('.typ') && options?.documentFontSize) {
            textContent = `#set text(size: ${options?.documentFontSize}pt)\n` + textContent;
          }

          buffer = Buffer.from(textContent, 'utf-8');
        } else {
          const base64Data = node.data.includes(',') ? node.data.split(',')[1] : node.data;
          buffer = Buffer.from(base64Data, 'base64');
        }

        const fileSize = buffer.length;
        if (fileSize > MAX_FILE_SIZE) {
          throw new Error(
            `File ${fileName} is too heavy (${(fileSize / 1024 / 1024).toFixed(2)}MB). Max 5MB.`,
          );
        }

        accumulator.totalSize += fileSize;
        if (accumulator.totalSize > MAX_SESSION_SIZE) {
          throw new Error(`Total project size exceeds session quota (10MB).`);
        }

        const dir = path.dirname(currentPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          accumulator.dirs.add(dir);
        }

        fs.writeFileSync(currentPath, buffer);
        accumulator.files.add(currentPath);
      } catch (err) {
        throw err;
      }
    }
  }
  return { createdFiles: accumulator.files, createdDirs: accumulator.dirs };
}

/**
 * Recursively deletes temporary files and empty directories created
 * during the compilation process to prevent disk space saturation.
 * @param {Set<string>} createdFiles - Set of absolute file paths to remove.
 * @param {Set<string>} createdDirs - Set of absolute directory paths to clean up.
 * @param {string} workingDir - The root session directory to be removed.
 */
function cleanupTemp(createdFiles: Set<string>, createdDirs: Set<string>, workingDir: string) {
  for (const file of createdFiles) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  const sortedDirs = Array.from(createdDirs).sort((a, b) => b.length - a.length);
  for (const dir of sortedDirs) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  }
  if (fs.existsSync(workingDir) && fs.readdirSync(workingDir).length === 0) {
    fs.rmdirSync(workingDir);
  }
}

/**
 * Parses the raw query() results for our sync markers into a clean array
 * of { line, page, x, y } (x/y in pt, as numbers). Tolerant of missing or
 * malformed entries - always returns an array, never throws.
 * @param {unknown} rawResults - Return value of compiler.query(..., { selector: '<tsync-marker>' }).
 * @returns {Array<{line: number, page: number, x: number, y: number}>}
 */
function parseSyncMarkers(rawResults: unknown) {
  if (!Array.isArray(rawResults)) return [];
  const parsePt = (v: unknown) => (typeof v === 'string' ? parseFloat(v.replace('pt', '')) : NaN);

  return (rawResults as RawSyncMarkerEntry[])
    .map((r) => ({
      line: r?.value?.line,
      page: r?.value?.loc?.page,
      x: parsePt(r?.value?.loc?.x),
      y: parsePt(r?.value?.loc?.y),
    }))
    .filter(
      (m): m is { line: number; page: number; x: number; y: number } =>
        typeof m.line === 'number' &&
        typeof m.page === 'number' &&
        !Number.isNaN(m.x) &&
        !Number.isNaN(m.y),
    );
}

/**
 * Main API Route Handler for Typst document compilation.
 * Manages session isolation, disk I/O, NodeCompiler execution,
 * and automated resource cleanup.
 * @param {Request} req - The incoming request containing fileTree, mainFile, and format.
 * @returns {Promise<NextResponse>} The compiled PDF blob or a JSON response (SVG/Logs).
 */
export async function POST(req: Request) {
  const sessionId = crypto.randomBytes(8).toString('hex');
  const workingDir = path.resolve(os.tmpdir(), `typst-${sessionId}`);

  const createdFiles = new Set<string>();
  const createdDirs = new Set<string>();

  try {
    const body = await req.json();
    const { fileTree, mainFile, format = 'svg', documentFontSize, sync = false } = body;

    const mainFileCleanPath = mainFile.replace(/^root\//, '');

    if (sync && format !== 'pdf') {
      patchMainFileContent(
        fileTree.children,
        mainFileCleanPath,
        (text) => injectSyncMarkers(text).content,
      );
    }

    if (!fs.existsSync(workingDir)) {
      fs.mkdirSync(workingDir, { recursive: true });
    }

    writeImages(
      fileTree.children,
      workingDir,
      { files: createdFiles, dirs: createdDirs, totalSize: 0 },
      { documentFontSize },
    );

    const absoluteMainPath = path.resolve(workingDir, mainFileCleanPath);

    const localCompiler = NodeCompiler.create({
      workspace: workingDir,
      inputs: { X: 'u' },
      fontArgs: [{ fontPaths: ['/usr/local/share/fonts'] }],
    });

    try {
      const compileOptions = {
        mainFilePath: absoluteMainPath,
      };

      if (format === 'pdf') {
        const pdfBuffer = localCompiler.pdf(compileOptions);
        return new NextResponse(new Uint8Array(pdfBuffer), {
          headers: { 'Content-Type': 'application/pdf' },
        });
      } else {
        const svg = localCompiler.svg(compileOptions);

        let syncMarkers: SyncMarker[] = [];
        if (sync) {
          try {
            const rawResults = localCompiler.query(compileOptions, { selector: '<tsync-marker>' });
            syncMarkers = parseSyncMarkers(rawResults);
          } catch (syncErr) {
            const e = syncErr as { message?: string; code?: string } | string;
            const errorMsg =
              typeof e === 'string' ? e : e?.message || e?.code || 'Compilation error';
            console.warn('Sync marker query failed (non-fatal):', errorMsg);
          }
        }

        return NextResponse.json({
          success: true,
          svg: svg,
          syncMarkers,
          logs: [
            {
              type: 'success',
              msg: 'Compilation successful',
              time: new Date().toLocaleTimeString(),
            },
          ],
        });
      }
    } catch (err) {
      const e = err as { message?: string; code?: string } | string;
      const errorMsg = typeof e === 'string' ? e : e?.message || e?.code || 'Compilation error';
      const cleanedError = errorMsg.replace(new RegExp(workingDir, 'g'), 'root');

      return NextResponse.json(
        {
          success: false,
          svg: null,
          syncMarkers: [],
          logs: [{ type: 'error', msg: cleanedError, time: new Date().toLocaleTimeString() }],
        },
        { status: 200 },
      );
    } finally {
      cleanupTemp(createdFiles, createdDirs, workingDir);
    }
  } catch (error) {
    const e = error as { message?: string; code?: string } | string;
    const errorMsg = typeof e === 'string' ? e : e?.message || e?.code || 'Compilation error';
    return NextResponse.json(
      {
        success: false,
        logs: [{ type: 'error', msg: errorMsg }],
      },
      { status: 400 },
    );
  }
}
