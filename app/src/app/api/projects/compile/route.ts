import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';


// ---------- Helper functions ---------- 

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
 * Recursively traverses the JSON file tree to recreate the folder structure 
 * and write files to the server's temporary local storage.
 * @param {any} children - The nested object containing file/folder nodes.
 * @param {string} baseDir - The target destination path on the disk.
 * @param {Object} accumulator - Tracking object to store created paths for cleanup.
 * @returns {Object} An object containing Sets of created file and directory paths.
 */
function writeImages(children: any = {}, baseDir: string, accumulator = { files: new Set<string>(), dirs: new Set<string>() }) {
  for (const fileName in children) {
    const node = children[fileName];
    const currentPath = path.join(baseDir, node.name || fileName);

    if (node.type === 'folder') {
      if (!fs.existsSync(currentPath)) {
        fs.mkdirSync(currentPath, { recursive: true });
        accumulator.dirs.add(currentPath);
      }
      writeImages(node.children, currentPath, accumulator);
    } else if (node.type === 'file') {
      if (!node.data) continue;
      try {
        const dir = path.dirname(currentPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          accumulator.dirs.add(dir);
        }
        
        if (fileName.endsWith('.typ')) {
            const textContent = decodeContent(node.data);
            fs.writeFileSync(currentPath, textContent, 'utf-8');
        } else {
            const base64Data = node.data.includes(',') ? node.data.split(',')[1] : node.data;
            fs.writeFileSync(currentPath, Buffer.from(base64Data, 'base64'));
        }
        
        accumulator.files.add(currentPath);
      } catch (err) {
        console.error(`Error writing ${currentPath}:`, err);
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
 * Main API Route Handler for Typst document compilation.
 * Manages session isolation, disk I/O, NodeCompiler execution, 
 * and automated resource cleanup.
 * @param {Request} req - The incoming request containing fileTree, mainFile, and format.
 * @returns {Promise<NextResponse>} The compiled PDF blob or a JSON response (SVG/Logs).
 */
export async function POST(req: Request) {
  const sessionId = crypto.randomBytes(8).toString('hex');
  const workingDir = path.resolve(os.tmpdir(), `typst-${sessionId}`);
  
  let createdFiles = new Set<string>();
  let createdDirs = new Set<string>();

  try {
    const body = await req.json();
    const { fileTree, mainFile, format = 'svg' } = body;

    const mainFileCleanPath = mainFile.replace(/^root\//, "");
    
    if (!fs.existsSync(workingDir)) {
      fs.mkdirSync(workingDir, { recursive: true });
    }

    const { createdFiles: files, createdDirs: dirs } = writeImages(fileTree.children, workingDir);
    createdFiles = files;
    createdDirs = dirs;

    const absoluteMainPath = path.resolve(workingDir, mainFileCleanPath);

    const localCompiler = NodeCompiler.create({ 
        workspace: workingDir,
        inputs: { 'X': 'u' } 
    });

    try {
      const compileOptions = { 
        mainFilePath: absoluteMainPath
      };

      if (format === 'pdf') {
        const pdfBuffer = localCompiler.pdf(compileOptions);
        return new NextResponse(new Uint8Array(pdfBuffer), { 
            headers: { 'Content-Type': 'application/pdf' } 
        });
      } 
      
      else {
        const svg = localCompiler.svg(compileOptions);
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
      const errorMsg = err.message || err.code || (typeof err === 'string' ? err : "Compilation error");
      const cleanedError = errorMsg.replace(new RegExp(workingDir, 'g'), "root");

      return NextResponse.json({
        success: false,
        svg: null,
        logs: [{ type: 'error', msg: cleanedError, time: new Date().toLocaleTimeString() }]
      }, { status: 200 });

    } finally {
      cleanupTemp(createdFiles, createdDirs, workingDir);
    }

  } catch (error: any) {
    return NextResponse.json({ 
        success: false, 
        logs: [{ type: 'error', msg: error.message || "Request error"}]  
    }, { status: 400 });
  }
}