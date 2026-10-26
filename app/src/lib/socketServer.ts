import { Server as SocketIOServer } from 'socket.io';
import { getToken } from 'next-auth/jwt';
import { prisma } from './prisma';
import { COMMENT_ROLES, EDIT_ROLES } from './comment-anchors';

import { Server as HTTPServer } from 'http';
import { Server as HTTPSServer } from 'https';

/** * In-memory storage for active users per document.
 * Structure: { [docId]: { [socketId]: email } }
 * @type {Record<string, Record<string, string>>}
 */
const activeUsers: Record<string, Record<string, string>> = {};

/**
 * Initializes the Socket.IO server with CORS and custom path.
 * @param {HTTPServer | HTTPSServer} httpServer - The underlying Node.js HTTP server.
 * @returns {SocketIOServer} The initialized IO server instance.
 */
export const initSocket = (httpServer: HTTPServer | HTTPSServer) => {
  const io = new SocketIOServer(httpServer, {
    path: '/api/ws',
    addTrailingSlash: false,
    // Reject cross-site handshakes (CORS does not apply to WebSocket upgrades).
    allowRequest: (req, callback) => {
      const origin = req.headers.origin;
      if (!origin) return callback(null, true);

      const forwardedHost = req.headers['x-forwarded-host'];
      const host =
        (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? req.headers.host;
      const allowed = new Set([host, process.env.AUTH_URL && new URL(process.env.AUTH_URL).host]);

      try {
        callback(null, allowed.has(new URL(origin).host));
      } catch {
        callback(null, false);
      }
    },
  });

  /**
   * Authenticates the socket from the NextAuth session cookie sent with the
   * handshake. The user ID is never taken from the client payload.
   */
  io.use(async (socket, next) => {
    try {
      const headers = { cookie: socket.handshake.headers.cookie ?? '' };
      const secret = process.env.AUTH_SECRET;
      const token =
        (await getToken({ req: { headers }, secret, secureCookie: true })) ??
        (await getToken({ req: { headers }, secret, secureCookie: false }));

      const userId = typeof token?.id === 'string' ? token.id : null;
      if (!userId) return next(new Error('Unauthorized'));

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { disabled: true },
      });
      if (!user || user.disabled) return next(new Error('Unauthorized'));

      socket.data.userId = userId;
      next();
    } catch (err) {
      console.error('Socket Auth Error:', err);
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    let session: {
      userId: string | null;
      docId: string | null;
      authorized: boolean;
      email: string | null;
      role: string | null;
    } = { userId: null, docId: null, authorized: false, email: null, role: null };

    let roleCheckedAt = 0;
    const ROLE_TTL_MS = 10_000;

    const leaveCurrentDoc = () => {
      const docId = session.docId;
      if (!docId) return;

      socket.leave(docId);
      if (activeUsers[docId]) {
        delete activeUsers[docId][socket.id];
        const uniqueUsers = [...new Set(Object.values(activeUsers[docId]))];
        if (uniqueUsers.length === 0) delete activeUsers[docId];
        else io.to(docId).emit('active-users-list', uniqueUsers);
      }
      session = { userId: session.userId, docId: null, authorized: false, email: null, role: null };
    };

    /**
     * Re-reads the user's role from the database at most every ROLE_TTL_MS,
     * so revoked or downgraded members lose access without reconnecting.
     */
    const refreshRole = async () => {
      if (!session.authorized || !session.docId) return false;
      if (Date.now() - roleCheckedAt < ROLE_TTL_MS) return true;

      const assignment = await prisma.projectAssignment.findUnique({
        where: { userId_projectId: { userId: socket.data.userId, projectId: session.docId } },
        select: { role: true },
      });
      roleCheckedAt = Date.now();

      if (!assignment) {
        socket.emit('error', 'Unauthorized: You no longer have access to this project');
        leaveCurrentDoc();
        return false;
      }
      session.role = assignment.role;
      return true;
    };

    const canRead = async (docId: unknown) =>
      typeof docId === 'string' && session.docId === docId && (await refreshRole());

    /** Viewers and commenters may join and see edits, but not emit write events. */
    const canWrite = async (docId: unknown) =>
      (await canRead(docId)) && EDIT_ROLES.includes(session.role ?? '');

    const canComment = async (docId: unknown) =>
      (await canRead(docId)) && COMMENT_ROLES.includes(session.role ?? '');

    const isString = (...values: unknown[]) => values.every((v) => typeof v === 'string');

    /**
     * Handles the 'join-document' event.
     * Verifies project ownership or shared access via Prisma before allowing the join.
     */
    socket.on('join-document', async ({ docId }: { docId: string }) => {
      const userId: string = socket.data.userId;
      if (typeof docId !== 'string' || !docId || !userId) return;

      try {
        const assignment = await prisma.projectAssignment.findUnique({
          where: {
            userId_projectId: {
              userId: userId,
              projectId: docId,
            },
          },
          select: {
            role: true,
            user: {
              select: { email: true },
            },
          },
        });

        if (session.docId && session.docId !== docId) leaveCurrentDoc();

        if (assignment) {
          const email = assignment.user?.email || 'Unknown User';

          socket.join(docId);
          session = { userId, docId, authorized: true, email, role: assignment.role };
          roleCheckedAt = Date.now();

          if (!activeUsers[docId]) activeUsers[docId] = {};
          activeUsers[docId][socket.id] = email;

          // Only count each user once, even if they have multiple sockets open
          const uniqueUsers = [...new Set(Object.values(activeUsers[docId]))];

          io.to(docId).emit('active-users-list', uniqueUsers);
          console.log(`User ${email} joined project ${docId}`);
        } else {
          socket.emit('error', 'Unauthorized: You do not have access to this project');
        }
      } catch (err) {
        console.error('Socket Auth Error:', err);
        socket.emit('error', 'Auth error');
      }
    });

    /**
     * Broadcasts file edits, node operations (CRUD), cursor movements and new entry point.
     * Only relays data if the session is authorized for the specific docId.
     */
    socket.on('edit-file', async ({ docId, filename, changes } = {}) => {
      if (isString(filename) && Array.isArray(changes) && (await canWrite(docId))) {
        socket.to(docId).emit('remote-edit', {
          filename,
          changes,
          userId: session.userId,
        });
      }
    });

    socket.on('create-node', async ({ docId, path, type } = {}) => {
      if (isString(path) && (type === 'file' || type === 'folder') && (await canWrite(docId))) {
        socket.to(docId).emit('node-created', { path, type });
      }
    });

    socket.on('rename-node', async ({ docId, oldPath, newPath } = {}) => {
      if (isString(oldPath, newPath) && (await canWrite(docId))) {
        socket.to(docId).emit('node-renamed', { oldPath, newPath });
      }
    });

    socket.on('delete-node', async ({ docId, path } = {}) => {
      if (isString(path) && (await canWrite(docId))) {
        socket.to(docId).emit('node-deleted', { path });
      }
    });

    socket.on('cursor-change', async ({ docId, filename, selection } = {}) => {
      if (
        isString(filename) &&
        selection &&
        typeof selection === 'object' &&
        (await canRead(docId))
      ) {
        socket.to(docId).emit('remote-cursor', {
          filename,
          selection,
          userId: session.userId,
          email: session.email,
        });
      }
    });

    socket.on('set-main-file', async ({ docId, path } = {}) => {
      if (isString(path) && (await canWrite(docId))) {
        socket.to(docId).emit('remote-set-main', { path });
      }
    });

    /**
     * Comments are persisted through Server Actions; this only tells the
     * other members to reload them. Resolving or deleting is also allowed to
     * an author whose role was downgraded, hence canRead for non-creations.
     */
    socket.on('comments-changed', async ({ docId, created } = {}) => {
      const allowed = created ? await canComment(docId) : await canRead(docId);
      if (allowed) {
        socket.to(docId).emit('comments-changed');
      }
    });

    socket.on('disconnect', () => {
      if (session.docId && activeUsers[session.docId]) {
        delete activeUsers[session.docId][socket.id];

        // Count unique users instead of sockets
        const uniqueUsers = [...new Set(Object.values(activeUsers[session.docId]))];

        if (uniqueUsers.length === 0) {
          delete activeUsers[session.docId];
        } else {
          io.to(session.docId).emit('active-users-list', uniqueUsers);
        }
      }
    });
  });

  return io;
};
