const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
require('dotenv').config();
const { NodeCompiler } = require('@myriaddreamin/typst-ts-node-compiler');

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

function cleanupTemp(createdFiles, createdDirs) {
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

async function canEditProject(userId, projectId) {
  try {
    const query = `SELECT id FROM "projects" WHERE id = $1 AND (user_id = $2 OR $2 = ANY(shared_users)) LIMIT 1;`;
    const res = await pool.query(query, [projectId, userId]);
    return res.rowCount > 0;
  } catch (err) {
    return false;
  }
}

function decodeContent(data) {
  if (data.startsWith('data:text/plain;base64,')) {
    return Buffer.from(data.split(',')[1], 'base64').toString('utf-8');
  }
  return data;
}

async function getUserEmail(userId) {
  try {
    const res = await pool.query('SELECT email FROM "users" WHERE id = $1', [userId]);
    return res.rows[0]?.email || "Unknown User";
  } catch (err) {
    return "Error User";
  }
}

// ---------- Routes ----------

app.post('/render', async (req, res) => {
  let body;
  try { body = JSON.parse(req.body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  const { fileTree } = body;
  const mainFile = fileTree?.children?.["main.typ"];
  if (!mainFile) return res.status(400).json({ error: 'Missing main.typ' });

  const { createdFiles, createdDirs } = writeImages(fileTree.children);
  try {
    const sourceCode = decodeContent(mainFile.data);
    const svg = $typst.svg({ mainFileContent: sourceCode });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    res.status(500).json({ error: 'Compilation failed' });
  } finally {
    cleanupTemp(createdFiles, createdDirs);
  }
});

app.post('/export/pdf', async (req, res) => {
  let body;
  try { body = JSON.parse(req.body); } catch { return res.status(400).json({ error: 'Invalid JSON' }); }

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
    res.status(500).json({ error: 'PDF failed' });
  } finally {
    cleanupTemp(createdFiles, createdDirs);
  }
});

// ---------- WebSocket Logic ----------

const activeUsers = {};

io.on('connection', (socket) => {
  let session = { userId: null, docId: null, authorized: false, email: null };

  socket.on('join-document', async ({ docId, userId }) => {
    if (!docId || !userId) return;
    try {
      const authorized = await canEditProject(userId, docId);
      if (authorized) {
        const email = await getUserEmail(userId);
        socket.join(docId);
        session = { userId, docId, authorized: true, email };

        if (!activeUsers[docId]) activeUsers[docId] = {};
        activeUsers[docId][socket.id] = email;

        io.to(docId).emit('active-users-list', Object.values(activeUsers[docId]));
      }
    } catch (err) {
      socket.emit('error', 'Auth error');
    }
  });

  socket.on('edit-file', ({ docId, filename, changes }) => {
    if (session.authorized && session.docId === docId) {
      socket.to(docId).emit('remote-edit', {
        filename,
        changes,
        userId: session.userId
      });
    }
  });

  socket.on('create-node', ({ docId, path, type }) => {
    if (session.authorized && session.docId === docId) {
      socket.to(docId).emit('node-created', { path, type });
    }
  });

  socket.on('rename-node', ({ docId, oldPath, newPath }) => {
    if (session.authorized && session.docId === docId) {
      socket.to(docId).emit('node-renamed', { oldPath, newPath });
    }
  });

  socket.on('delete-node', ({ docId, path }) => {
    if (session.authorized && session.docId === docId) {
      socket.to(docId).emit('node-deleted', { path });
    }
  });

  socket.on('disconnect', () => {
    if (session.docId && activeUsers[session.docId]) {
      delete activeUsers[session.docId][socket.id];
      const remaining = Object.values(activeUsers[session.docId]);
      if (remaining.length === 0) {
        delete activeUsers[session.docId];
      } else {
        io.to(session.docId).emit('active-users-list', remaining);
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`Typst API & WebSocket server running on http://localhost:${PORT}`);
});