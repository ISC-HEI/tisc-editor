import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';

const $typst = NodeCompiler.create({ inputs: { 'X': 'u' } });

// ---------- Helper functions ---------- 

/**
 * Recursively writes files and folders from the JSON file tree to the server's local storage.
 * This allows the Typst compiler to access local assets (images, other .typ files).
 * @param {Object} children - The current level of the file tree.
 * @param {string} [baseDir="."] - The base directory for writing files.
 * @param {Object} accumulator - Tracks created paths for later cleanup.
 * @returns {Object} Sets of created files and directories.
 */
function writeImages(children: any = {}, baseDir = ".", accumulator = { files: new Set<string>(), dirs: new Set<string>() }) {
  for (const fileName in children) {
    const node = children[fileName];
    const currentPath = path.join(baseDir, node.name || fileName);

    if (node.type === 'folder') {
      if (!fs.existsSync(currentPath)) {
        fs.mkdirSync(currentPath, { recursive: true });
        accumulator.dirs.add(currentPath);
      }
      writeImages(node.children, currentPath, accumulator);
    } else if (node.type === 'file' && fileName !== "main.typ") {
      if (!node.data) continue;
      try {
        const dir = path.dirname(currentPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          accumulator.dirs.add(dir);
        }
        const base64Data = node.data.includes(',') ? node.data.split(',')[1] : node.data;
        fs.writeFileSync(currentPath, Buffer.from(base64Data, 'base64'));
        accumulator.files.add(currentPath);
      } catch (err) {
        console.error(`Error writing ${currentPath}:`, err);
      }
    }
  }
  return { createdFiles: accumulator.files, createdDirs: accumulator.dirs };
}

/**
 * Deletes all temporary files and empty directories created during the compilation process.
 * Prevents memory leaks and storage clogging on the server.
 * @param {Set<string>} createdFiles - Set of file paths to delete.
 * @param {Set<string>} createdDirs - Set of directory paths to remove.
 */
function cleanupTemp(createdFiles: Set<string>, createdDirs: Set<string>) {
  for (const file of createdFiles) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  const sortedDirs = Array.from(createdDirs).sort((a, b) => b.length - a.length);
  for (const dir of sortedDirs) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  }
}

/**
 * Decodes the content of a file. 
 * Converts Base64 encoded strings back to UTF-8 text if necessary.
 * @param {string} data - The raw data string from the file tree.
 * @returns {string} The decoded plain text content.
 */
function decodeContent(data: string) {
  if (data.startsWith('data:text/plain;base64,')) {
    return Buffer.from(data.split(',')[1], 'base64').toString('utf-8');
  }
  return data;
}

// ---------- Route POST ----------

/**
 * API Route Handler for document compilation.
 * 1. Receives the file tree and target format.
 * 2. Prepares the local environment (writeImages).
 * 3. Compiles using the @myriaddreamin/typst-ts-node-compiler.
 * 4. Cleans up temp files and returns the binary result.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fileTree, format = 'svg' } = body;

    const mainFile = fileTree?.children?.["main.typ"];
    if (!mainFile) {
      return NextResponse.json({ error: 'Missing main.typ' }, { status: 400 });
    }

    const { createdFiles, createdDirs } = writeImages(fileTree.children);

    try {
      const sourceCode = decodeContent(mainFile.data);

      if (format === 'pdf') {
        const pdfBuffer = $typst.pdf({ mainFileContent: sourceCode });
        return new NextResponse(pdfBuffer, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
          },
        });
      } else {
        const svg = $typst.svg({ mainFileContent: sourceCode });
        return new NextResponse(svg, {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml',
          },
        });
      }

    } catch (err) {
      console.error("Compilation error:", err);
      return NextResponse.json({ error: 'Compilation failed' }, { status: 500 });
    } finally {
      cleanupTemp(createdFiles, createdDirs);
    }

  } catch (error) {
    return NextResponse.json({ error: 'Invalid Request Body' }, { status: 400 });
  }
}