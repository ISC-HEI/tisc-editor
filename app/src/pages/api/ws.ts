import { NextApiRequest } from 'next';
import { initSocket } from '@/lib/socketServer';

export default function handler(req: NextApiRequest, res: any) {
  if (!res.socket.server.io) {
    initSocket(res.socket.server);
  }
  res.end();
}