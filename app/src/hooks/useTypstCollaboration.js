import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { functions, refs } from './refs';
import { fileTree as globalFileTree, currentFilePath, isLoadingFile, fetchCompile, syncFileTreeWithEditor } from './useEditor';
import { debounce, makeToast } from './useUtils';

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_COMPILER_URL;

const findNodeByPath = (root, path) => {
  if (!root || !path) return null;
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

export const useTypstCollaboration = (docId, userId) => {
  const prevUsersRef = useRef([]);
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

  const updateContent = useCallback(() => {
    if (isRemoteChange.current || isLoadingFile) return;

    syncFileTreeWithEditor();
    
    if (socketRef.current?.connected) {
      socketRef.current.emit('update-content', { 
        docId: docId, 
        userId: userId, 
        content: globalFileTree 
      });
    }
  }, [docId, userId]);

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
        globalFileTree.children = newFileTree.children;

        import("./useFileManager").then(m => {
            m.renderFileExplorer(globalFileTree);
        });
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

    socket.on('active-users-list', (emails) => {
        if (refs.userCount) {
            refs.userCount.innerText = emails.length;
        }
        if (refs.userListContainer) {
          refs.userListContainer.innerHTML = "";
          emails.forEach(email => {
              const div = document.createElement("div");
              div.className = "px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-3";
              div.innerHTML = `
                  <div class="relative flex-shrink-0">
                      <div class="h-7 w-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-[10px] uppercase border border-blue-200">
                          ${email.charAt(0)}
                      </div>
                      <div class="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  <span class="truncate font-medium">${email}</span>
              `;
              refs.userListContainer.appendChild(div);
          });
        }

        const prevUsers = prevUsersRef.current;
        const joined = emails.filter(email => !prevUsers.includes(email));
        const left = prevUsers.filter(email => !emails.includes(email));

        if (prevUsers.length > 0) {
            joined.forEach(email => makeToast(`${email} joined`, "info"));
            left.forEach(email => makeToast(`${email} left`, "warning"));
        }

        prevUsersRef.current = emails;
    });

    socket.on('error', (msg) => console.error("Collaboration Error:", msg));

    functions.syncCollaboration = () => {
        updateContent();
    };

    return () => {
      socket.disconnect();
      functions.syncCollaboration = null;
    };
  }, [docId, userId, debouncedRefresh, updateContent]);

  return { updateContent };
};