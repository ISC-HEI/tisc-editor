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
function writeImages(children: any = {}, mainFile: string, baseDir = ".", accumulator = { files: new Set<string>(), dirs: new Set<string>() }) {
  for (const fileName in children) {
    const node = children[fileName];
    const currentPath = path.join(baseDir, node.name || fileName);

    if (node.type === 'folder') {
      if (!fs.existsSync(currentPath)) {
        fs.mkdirSync(currentPath, { recursive: true });
        accumulator.dirs.add(currentPath);
      }
      writeImages(node.children, mainFile, currentPath, accumulator);
    } else if (node.type === 'file' && fileName !== mainFile) {
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

/**
 * Find a specific node from a path
 * @param {any} node The node to check in 
 * @param {sting} targetPath The path of the file
 * @returns 
 */
function findNodeByPath(node: any, targetPath: string): any {
  if (node.fullPath === targetPath || node.name === targetPath) {
    return node;
  }
  if (node.children) {
    for (const key in node.children) {
      const found = findNodeByPath(node.children[key], targetPath);
      if (found) return found;
    }
  }
  return null;
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
  let createdFiles = new Set<string>();
  let createdDirs = new Set<string>();

  try {
    const body = await req.json();
    const { fileTree, mainFile, format = 'svg' } = body;

    const mainFileNode = findNodeByPath(fileTree, mainFile.replace(/^root\//, ""));
    if (!mainFileNode || !mainFileNode.data) {
      return NextResponse.json({ 
        success: false, 
        logs: [{ type: 'error', msg: 'Main file not found'}] 
      }, { status: 404 });
    }

    const { createdFiles: files, createdDirs: dirs } = writeImages(fileTree.children, mainFile);
    createdFiles = files;
    createdDirs = dirs;

    try {
      const sourceCode = decodeContent(mainFileNode.data);

      if (format === 'pdf') {
        const pdfBuffer = $typst.pdf({ mainFileContent: sourceCode });
        return new NextResponse(pdfBuffer, { headers: { 'Content-Type': 'application/pdf' } });
      } 
      
      else {
        const svg = $typst.svg({ mainFileContent: sourceCode });
        
        return NextResponse.json({
          success: true,
          svg: svg,
          logs: [{ 
            type: 'success', 
            msg: 'Compilation successful', 
            time: new Date().toLocaleTimeString() 
          }]
        });
      }

    } catch (err: any) {
      // Replace to adapt to the client
      const errorMsg = err.code.replace("/app/", "/root/")

      const errorLog = {
        type: 'error',
        msg: errorMsg || "Unknown compilation error",
        time: new Date().toLocaleTimeString()
      };

      return NextResponse.json({
        success: false,
        svg: null,
        logs: [errorLog]
      }, { status: 200 });

    } finally {
      cleanupTemp(createdFiles, createdDirs);
    }

  } catch (error) {
    return NextResponse.json({ success: false, error: 'Invalid Request' }, { status: 400 });
  }
}