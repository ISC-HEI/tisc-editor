import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_COMPILER_URL;

export const useTypstCollaboration = (docId, userId, initialContent) => {
  const [content, setContent] = useState(initialContent);
  const socketRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !userId || !docId) return;

    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-document', { docId, userId });
    });

    socket.on('content-updated', (newContent) => {
      setContent(newContent);
    });

    socket.on('error', (msg) => {
      console.error("Collaboration Error:", msg);
    });

    return () => {
      if (socket) {
        socket.off('content-updated');
        socket.off('error');
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [docId, userId]);

  const updateContent = (newContent) => {
    setContent(newContent);
    
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('update-content', { 
        docId: docId, 
        userId: userId, 
        content: newContent 
      });
    }
  };

  return { content, updateContent };
};