import { Server as SocketIOServer } from 'socket.io';
import { prisma } from './prisma';

const activeUsers: Record<string, Record<string, string>> = {};

export const initSocket = (httpServer: any) => {
  const io = new SocketIOServer(httpServer, {
    path: '/api/ws',
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    let session: { 
      userId: string | null; 
      docId: string | null; 
      authorized: boolean; 
      email: string | null 
    } = { userId: null, docId: null, authorized: false, email: null };

    socket.on('join-document', async ({ docId, userId }: { docId: string, userId: string }) => {
      if (!docId || !userId) return;

      try {
        const project = await prisma.project.findFirst({
          where: {
            id: docId,
            OR: [
              { userId: userId },
              { sharedUsers: { has: userId } }
            ]
          },
          select: {
            id: true,
            user: {
              select: { email: true }
            }
          }
        });

        if (project) {
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true }
          });

          const email = user?.email || "Unknown User";

          socket.join(docId);
          session = { userId, docId, authorized: true, email };

          if (!activeUsers[docId]) activeUsers[docId] = {};
          activeUsers[docId][socket.id] = email;

          io.to(docId).emit('active-users-list', Object.values(activeUsers[docId]));
          console.log(`User ${email} joined project ${docId}`);
        } else {
          socket.emit('error', 'Unauthorized: You do not have access to this project');
        }
      } catch (err) {
        console.error("Socket Auth Error:", err);
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

  return io;
};