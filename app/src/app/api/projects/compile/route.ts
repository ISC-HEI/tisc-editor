import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';

const $typst = NodeCompiler.create({ inputs: { 'X': 'u' } });

// ---------- Helper functions ---------- 

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

function decodeContent(data: string) {
  if (data.startsWith('data:text/plain;base64,')) {
    return Buffer.from(data.split(',')[1], 'base64').toString('utf-8');
  }
  return data;
}

// ---------- Route POST ----------

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