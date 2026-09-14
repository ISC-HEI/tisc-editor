import type { Server as HTTPServer } from 'http';
import type { Server as IOServer } from 'socket.io';
import type { Socket as NetSocket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';
import { initSocket } from '@/lib/socketServer';

interface SocketServer extends HTTPServer {
  io?: IOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

/**
 * API route handler to initialize the WebSocket server.
 * This is a workaround for Next.js API routes to support persistent Socket.IO connections.
 * It ensures the Socket.IO server is attached to the HTTP server instance only once.
 * @param {NextApiRequest} req - The incoming HTTP request.
 * @param {NextApiResponseWithSocket} res - The response object, augmented with the underlying socket server.
 */
export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    initSocket(res.socket.server);
  }
  res.end();
}
