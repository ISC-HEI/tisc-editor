import { NextApiRequest } from 'next';
import { initSocket } from '@/lib/socketServer';

/**
 * API route handler to initialize the WebSocket server.
 * This is a workaround for Next.js API routes to support persistent Socket.IO connections.
 * It ensures the Socket.IO server is attached to the HTTP server instance only once.
 * * @param {NextApiRequest} req - The incoming HTTP request.
 * @param {any} res - The response object, augmented with the underlying socket server.
 */
export default function handler(req: NextApiRequest, res: any) {
  if (!res.socket.server.io) {
    initSocket(res.socket.server);
  }
  res.end();
}