import type { Server as HTTPServer } from 'http';
import type { Server as IOServer } from 'socket.io';
import type { Socket as NetSocket } from 'net';
import { NextApiResponse } from 'next';

interface SocketServer extends HTTPServer {
  io?: IOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

export interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}
