import { useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { refs } from './refs';
import { fileTree as globalFileTree, currentFilePath, isLoadingFile, fetchCompile, syncFileTreeWithEditor } from './useEditor';
import { debounce, makeToast } from './useUtils';

const WEBSOCKET_URL = process.env.NEXT_PUBLIC_COMPILER_URL;

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

    const updateContent = useCallback((changeData) => {
        if (isRemoteChange.current || isLoadingFile) return;

        if (socketRef.current?.connected) {
            socketRef.current.emit('edit-file', {
                docId,
                userId,
                ...changeData
            });
        }
    }, [docId, userId]);

    useEffect(() => {
        if (typeof window === 'undefined' || !userId || !docId) return;

        const socket = io(WEBSOCKET_URL, { transports: ['websocket'] });
        socketRef.current = socket;
        refs.socket = socket;

        socket.on('connect', () => {
            socket.emit('join-document', { docId, userId });
        });

        socket.on('remote-edit', ({ filename, changes }) => {
            if (!refs.editor || filename !== currentFilePath) return;

            const model = refs.editor.getModel();
            if (!model) return;

            isRemoteChange.current = true;
            
            const monaco = window.monaco || refs.monaco;
            
            const edits = changes.map(c => ({
                range: new monaco.Range(
                    c.range.startLineNumber,
                    c.range.startColumn,
                    c.range.endLineNumber,
                    c.range.endColumn
                ),
                text: c.text,
                forceMoveMarkers: true
            }));

            model.pushEditOperations(
                refs.editor.getSelections(), 
                edits, 
                () => refs.editor.getSelections()
            );
            
            isRemoteChange.current = false;
            debouncedRefresh();
        });

        socket.on('node-created', ({ path, type }) => {
            import("./useFileManager").then(m => {
                m.addNodeToLocalTree(globalFileTree, path, type);
                m.renderFileExplorer(globalFileTree);
            });
            makeToast(`New ${type} created: ${path}`, "info");
        });

        socket.on('node-renamed', ({ oldPath, newPath }) => {
            import("./useFileManager").then(m => {
                m.renameNodeInLocalTree(globalFileTree, oldPath, newPath);
                m.renderFileExplorer(globalFileTree);
            });
        });

        socket.on('node-deleted', ({ path }) => {
            import("./useFileManager").then(m => {
                m.deleteNodeFromLocalTree(globalFileTree, path);
                m.renderFileExplorer(globalFileTree);
            });
            makeToast(`File deleted: ${path}`, "warning");
        });

        socket.on('active-users-list', (emails) => {
            if (refs.userCount) refs.userCount.innerText = emails.length;
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

            const joined = emails.filter(email => !prevUsersRef.current.includes(email));
            const left = prevUsersRef.current.filter(email => !emails.includes(email));
            if (prevUsersRef.current.length > 0) {
                joined.forEach(email => makeToast(`${email} joined`, "info"));
                left.forEach(email => makeToast(`${email} left`, "warning"));
            }
            prevUsersRef.current = emails;
        });

        socket.on('error', (msg) => console.error("Collaboration Error:", msg));

        return () => {
            socket.disconnect();
        };
    }, [docId, userId, debouncedRefresh]);

    return { updateContent };
};