const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
require('dotenv').config();
const { NodeCompiler } = require('@myriaddreamin/typst-ts-node-compiler');;

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
function writeImages(imgPaths = {}) {
  const createdFiles = new Set();
  const createdDirs = new Set();

  for (const p in imgPaths) {
    const base64Img = imgPaths[p].split(',')[1];
    const filePath = p;
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      createdDirs.add(dir);
    }

    fs.writeFileSync(filePath, Buffer.from(base64Img, 'base64'));
    createdFiles.add(filePath);
  }

  return { createdFiles, createdDirs };
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
// ---------- Routes ----------

// Render Typst source to SVG
app.post('/render', (req, res) => {
  let body;
  try {
    body = JSON.parse(req.body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { source, images: imgPaths } = body;
  if (!source) return res.status(400).json({ error: 'Missing source' });

  const { createdFiles, createdDirs } = writeImages(imgPaths);

  try {
    const svg = $typst.svg({ inputs: { 'Y': 'v' }, mainFileContent: source });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Compilation failed', details: err.code });
  } finally {
    cleanupTemp(createdFiles, createdDirs);
  }
});

// Export Typst source to PDF
app.post('/export/pdf', (req, res) => {
  let body;
  try {
    body = JSON.parse(req.body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { source, images: imgPaths } = body;
  if (!source) return res.status(400).json({ error: 'Missing source' });

  const { createdFiles, createdDirs } = writeImages(imgPaths);

  try {
    const pdfBuffer = $typst.pdf({ mainFileContent: source });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="document.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err);
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