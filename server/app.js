const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
require('dotenv').config();
const { NodeCompiler } = require('@myriaddreamin/typst-ts-node-compiler');const { PassThrough } = require('stream');
;

const $typst = NodeCompiler.create({ inputs: { 'X': 'u' } });
const app = express();
const PORT = 3001;

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(cors());
app.use(express.text({ limit: '50mb', type: '*/*' }));

// ---------- Helper functions ----------

// Write all images from imgPaths and return sets of created files and directories
function writeImages(children = {}, baseDir = ".", accumulator = { files: new Set(), dirs: new Set() }) {
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

        const base64Data = node.data.includes(',') 
          ? node.data.split(',')[1] 
          : node.data;

        fs.writeFileSync(currentPath, Buffer.from(base64Data, 'base64'));
        accumulator.files.add(currentPath);
      } catch (err) {
        console.error(`Error writing ${currentPath}:`, err);
      }
    }
  }

  return { createdFiles: accumulator.files, createdDirs: accumulator.dirs };
}

// Delete temporary files and empty directories
function cleanupTemp(createdFiles, createdDirs) {
  for (const file of createdFiles) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  // Remove directories from longest path to shortest
  const sortedDirs = Array.from(createdDirs).sort((a, b) => b.length - a.length);
  for (const dir of sortedDirs) {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
    }
  }
}

// Check if a user can have access to a document
async function canEditProject(userId, projectId) {
  try {
    const query = `
      SELECT id FROM "projects" 
      WHERE id = $1 
      AND (user_id = $2 OR $2 = ANY(shared_users))
      LIMIT 1;
    `;
    
    const res = await pool.query(query, [projectId, userId]);
    return res.rowCount > 0;
  } catch (err) {
    console.error("Erreur SQL Permission:", err);
    return false;
  }
}

// Decode the main content
function decodeContent(data) {
  if (data.startsWith('data:text/plain;base64,')) {
    return Buffer.from(data.split(',')[1], 'base64').toString('utf-8');
  }
  return data;
}
// ---------- Routes ----------

// Render Typst source to SVG
app.post('/render', async (req, res) => {
  let body;
  try {
    body = JSON.parse(req.body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { fileTree } = body;
  const mainFile = fileTree?.children?.["main.typ"];
  if (!mainFile) return res.status(400).json({ error: 'Missing main.typ in fileTree' });

  const { createdFiles, createdDirs } = writeImages(fileTree.children);

  try {
    const sourceCode = decodeContent(mainFile.data);
    
    const svg = $typst.svg({ mainFileContent: sourceCode });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Compilation failed' });
  } finally {
    cleanupTemp(createdFiles, createdDirs);
  }
});

// Export Typst source to PDF
app.post('/export/pdf', async (req, res) => {
  let body;
  try {
    body = JSON.parse(req.body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { fileTree } = body;
  const mainFile = fileTree?.children?.["main.typ"];
  
  if (!mainFile) return res.status(400).json({ error: 'Missing main.typ' });

  const { createdFiles, createdDirs } = writeImages(fileTree.children);

  try {
    const sourceCode = decodeContent(mainFile.data);
    const pdfBuffer = $typst.pdf({ mainFileContent: sourceCode });

    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  } finally {
    cleanupTemp(createdFiles, createdDirs);
  }
});

// -------- WEBSOCKET --------
io.on('connection', (socket) => {
  console.log(`New user connected: ${socket.id}`);
  
  let session = { userId: null, docId: null, authorized: false };

  socket.on('join-document', async ({ docId, userId }) => {
    if (!docId || !userId) {
      return socket.emit('error', 'Document Id and User Id required');
    }

    try {
      const authorized = await canEditProject(userId, docId);

      if (authorized) {
        socket.join(docId);
        
        session.userId = userId;
        session.docId = docId;
        session.authorized = true;
        
        console.log(`User ${userId} joined room ${docId}`);
      } else {
        socket.emit('error', 'You cannot access this document');
      }
    } catch (err) {
      console.error("Join error:", err);
      socket.emit('error', 'Internal server error');
    }
  });

  socket.on('update-content', ({ docId, userId, content }) => {
    if (session.authorized && session.docId === docId && session.userId === userId) {
      socket.to(docId).emit('content-updated', content);
    } else {
      socket.emit('error', 'Unauthorized update');
    }
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`Typst API & WebSocket server running on http://localhost:${PORT}`);
});