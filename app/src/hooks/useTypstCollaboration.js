import { useEffect, useRef, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import { refs } from './refs';
import { fileTree as globalFileTree, currentFilePath, isLoadingFile, fetchCompile, syncFileTreeWithEditor } from './useEditor';
import { debounce } from './useUtils';

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_COMPILER_URL;

const findNodeByPath = (root, path) => {
  const parts = path.replace("root/", "").split("/");
  let current = root;
  for (const part of parts) {
    if (current && current.children && current.children[part]) {
      current = current.children[part];
    } else {
      return null;
    }
  }
  return current;
};

export const useTypstCollaboration = (docId, userId, initialFileTree) => {
  const [fileTreeState, setFileTreeState] = useState(initialFileTree);
  const socketRef = useRef(null);
  const isRemoteChange = useRef(false);

  const debouncedRefresh = useMemo(
    () =>
      debounce(async () => {
        if (isLoadingFile) return;
        syncFileTreeWithEditor();
        await fetchCompile();
      }, 1000),
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !userId || !docId) return;

    const socket = io(WEBSOCKET_URL, {
      transports: ['websocket'],
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-document', { docId, userId });
    });

    socket.on('content-updated', (newFileTree) => {
      if (newFileTree && newFileTree.children) {
        Object.assign(globalFileTree.children, newFileTree.children);
      }

      if (!refs.editor || isLoadingFile) {
        debouncedRefresh();
        return;
      }

      const model = refs.editor.getModel();
      const currentVal = model.getValue();
      
      const remoteNode = findNodeByPath(newFileTree, currentFilePath);
      if (!remoteNode) {
          debouncedRefresh();
          return;
      }

      let newVal = remoteNode.data || "";

      if (newVal.startsWith('data:')) {
        try {
          const base64 = newVal.split(',')[1];
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          newVal = new TextDecoder().decode(bytes);
        } catch (e) {
          console.error(e);
        }
      }

      if (currentVal !== newVal) {
        isRemoteChange.current = true;
        const currentSelections = refs.editor.getSelections();

        model.pushEditOperations(
          currentSelections,
          [{
            range: model.getFullModelRange(),
            text: newVal
          }],
          () => currentSelections
        );

        isRemoteChange.current = false;
      }

      debouncedRefresh();
    });

    socket.on('error', (msg) => console.error("Collaboration Error:", msg));

    return () => {
      socket.disconnect();
    };
  }, [docId, userId, debouncedRefresh]);

  const updateContent = (newTextContent) => {
    if (isRemoteChange.current || isLoadingFile) return;

    syncFileTreeWithEditor();
    
    if (socketRef.current?.connected) {
      socketRef.current.emit('update-content', { 
        docId: docId, 
        userId: userId, 
        content: globalFileTree 
      });
    }
  };

  return { content: fileTreeState, updateContent };
};