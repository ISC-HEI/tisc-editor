import { useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { refs } from './refs';
import { fileTree as globalFileTree, currentFilePath, isLoadingFile, fetchCompile, syncFileTreeWithEditor, setIsLoadingFile } from './useEditor';
import { debounce, makeToast, stringToColor } from './useUtils';
import { renderFileExplorer } from './useFileManager';

/**
 * React hook that manages real-time collaboration using Socket.IO.
 * Handles document synchronization, remote cursor rendering, and file tree updates.
 * * @param {string} docId - The unique identifier of the document/project.
 * @param {string} userId - The current user's email or unique ID.
 * @returns {Object} Functions to emit local changes and cursor movements.
 */
export const useTypstCollaboration = (docId, userId) => {
    /** @type {Object} Keeps track of connected users to detect join/leave events */
    const prevUsersRef = useRef([]);

    /** @type {Object} Reference to the Socket.IO instance */
    const socketRef = useRef(null);

    /** @type {Object} Flag to prevent local change emission when applying remote edits */
    const isRemoteChange = useRef(false);

    /** @type {Object} Map of Monaco decoration IDs for each remote user's cursor */
    const remoteCursorsRef = useRef({});

    /**
     * Debounced function to re-compile the document after remote or local edits.
    */
    const debouncedRefresh = useMemo(
        () =>
            debounce(async () => {
                if (isLoadingFile) return;
                syncFileTreeWithEditor();
                await fetchCompile();
            }, 1000),
        []
    );

    /**
     * Sends local editor changes to the server.
     * @param {Object} changeData - The Monaco change event data.
     */
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

    /**
     * Broadcasts the current user's cursor position or text selection.
     * @param {Object} cursorData - Position and selection range data.
     */
    const updateCursor = useCallback((cursorData) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('cursor-change', {
                docId,
                ...cursorData
            });
        }
    }, [docId]);

    useEffect(() => {
        if (typeof window === 'undefined' || !userId || !docId) return;

        const socket = io(window.location.origin, {
            path: '/api/ws',
            transports: ['websocket'],
            upgrade: false,
            reconnectionAttempts: 5
        });
        socketRef.current = socket;
        refs.socket = socket;

        socket.on('connect', () => {
            socket.emit('join-document', { docId, userId });
        });

        /**
         * Triggered when a remote user edits the current file.
         * Injects changes into the Monaco model without breaking the undo stack.
         */
        socket.on('remote-edit', ({ filename, changes }) => {
            updateFileInTree(globalFileTree, filename, (oldContent) => {
                return applyMonacoChangesToString(oldContent || "", changes);
            });

            if (refs.editor && filename === currentFilePath) {
                const model = refs.editor.getModel();
                if (model) {
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
                }
            } else {
                import("./useFileManager").then(m => {
                    m.renderFileExplorer(globalFileTree); 
                });
            }

            debouncedRefresh();
        });

        /**
         * Real-time File System Sync: 
         * Listeners for node creation, renaming, and deletion from other peers.
         */
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

        /**
         * Presence Management:
         * Updates the UI user list and triggers toasts for join/leave events.
         * Cleans up cursors when a user disconnects.
         */
        socket.on('active-users-list', (emails) => {
            if (refs.userCount) refs.userCount.innerText = emails.length;
            if (refs.userListContainer) {
                refs.userListContainer.innerHTML = "";
                emails.forEach(email => {
                    const colors = stringToColor(email);
                    const div = document.createElement("div");
                    div.className = "px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-3";
                    div.innerHTML = `
                        <div class="relative flex-shrink-0">
                            <div class="h-7 w-7 rounded-full flex items-center justify-center font-bold text-[10px] uppercase border" 
                                style="background-color: ${colors.base}; 
                                        color: ${colors.darker}; 
                                        border-color: ${colors.dark};">
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
                left.forEach(email => {
                    makeToast(`${email} left`, "warning");

                    if (refs.editor && remoteCursorsRef.current[email]) {
                        refs.editor.deltaDecorations(remoteCursorsRef.current[email], []);
                        delete remoteCursorsRef.current[email];
                    }

                    const styleElement = document.getElementById(`cursor-style-${email}`);
                    if (styleElement) styleElement.remove();
                });
            }
            prevUsersRef.current = emails;
        });

        /**
         * Remote Cursor Rendering:
         * Uses Monaco 'deltaDecorations' to draw other users' cursors and selections.
         * Dynamically injects CSS for user-specific colors.
         */
        socket.on('remote-cursor', ({ filename, selection, email, userId: remoteUserId }) => {
            if (!refs.editor || remoteUserId === userId) return;

            if (filename !== currentFilePath) {
                if (remoteCursorsRef.current[email]) {
                    remoteCursorsRef.current[email] = refs.editor.deltaDecorations(
                        remoteCursorsRef.current[email], 
                        []
                    );
                }
                return;
            }
            const monaco = window.monaco || refs.monaco;
            const colors = stringToColor(email);

            if (!document.getElementById(`cursor-style-${email}`)) {
                const style = document.createElement('style');
                style.id = `cursor-style-${email}`;
                style.innerHTML = `
                    .remote-cursor-${remoteUserId} {
                        border-left: 2px solid ${colors.dark};
                        position: absolute;
                        height: 100%;
                    }
                    .remote-cursor-label-${remoteUserId}::after {
                        content: '${email.split('@')[0]}';
                        position: absolute;
                        top: -1.2em;
                        left: -2px;
                        background: ${colors.dark};
                        color: white;
                        font-size: 10px;
                        padding: 2px 4px;
                        border-radius: 2px;
                        white-space: nowrap;
                        z-index: 50;
                        pointer-events: none;
                    }
                    .remote-selection-${remoteUserId} {
                        background-color: ${colors.dark};
                        opacity: 0.2;
                    }
                `;
                document.head.appendChild(style);
            }

            const decorations = [];

            decorations.push({
                range: new monaco.Range(
                    selection.positionLineNumber, 
                    selection.positionColumn, 
                    selection.positionLineNumber, 
                    selection.positionColumn
                ),
                options: {
                    className: `remote-cursor-${remoteUserId} remote-cursor-label-${remoteUserId}`,
                    stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                }
            });

            const hasSelection = selection.startLineNumber !== selection.endLineNumber || selection.startColumn !== selection.endColumn;
            if (hasSelection) {
                decorations.push({
                    range: new monaco.Range(
                        selection.startLineNumber,
                        selection.startColumn,
                        selection.endLineNumber,
                        selection.endColumn
                    ),
                    options: {
                        className: `remote-selection-${remoteUserId}`,
                    }
                });
            }

            remoteCursorsRef.current[email] = refs.editor.deltaDecorations(
                remoteCursorsRef.current[email] || [],
                decorations
            );
        });

        /**
         * Set new main entry point
         * Listener to update the main entry point for the
         * compilation and export.
         */
        socket.on('remote-set-main', ({ path }) => {
            console.log(path)
            const updateMainInTree = (node) => {
                if (node.type === "file") {
                    node.isMain = (node.fullPath === path || `root/${node.fullPath}` === path);
                } else if (node.children) {
                    Object.values(node.children).forEach(updateMainInTree);
                }
            };

            updateMainInTree(globalFileTree);

            import("./useFileManager").then(m => {
                m.renderFileExplorer(globalFileTree);
            });

            const fileName = path.split('/').pop();
            makeToast(`Remote: ${fileName} is now main`, "info");

            setTimeout(() => {
                setIsLoadingFile(false);
                renderFileExplorer(globalFileTree);
                fetchCompile();
            }, 200);
        });

        socket.on('error', (msg) => console.error("Collaboration Error:", msg));

        return () => {
            socket.disconnect();
        };
    }, [docId, userId, debouncedRefresh]);

    return { updateContent, updateCursor };
};

function applyMonacoChangesToString(source, changes) {
    let content = source || "";
    let lines = content.split("\n");
    
    changes.forEach(change => {
        const { range, text } = change;
        const startLine = range.startLineNumber - 1;
        const endLine = range.endLineNumber - 1;
        const startCol = range.startColumn - 1;
        const endCol = range.endColumn - 1;

        while (lines.length <= endLine) {
            lines.push("");
        }

        const prefix = (lines[startLine] || "").substring(0, startCol);
        const suffix = (lines[endLine] || "").substring(endCol);
        
        const newTextLines = (prefix + text + suffix).split("\n");
        
        lines.splice(startLine, (endLine - startLine) + 1, ...newTextLines);
    });

    return lines.join("\n");
}

const updateFileInTree = (node, targetPath, updateFn) => {
    const nodePath = node.fullPath;
    
    if (node.type === 'file' && (nodePath === targetPath || `root/${nodePath}` === targetPath)) {
        node.content = updateFn(node.content);
        return true;
    }

    if (node.children) {
        for (const key in node.children) {
            if (updateFileInTree(node.children[key], targetPath, updateFn)) {
                return true;
            }
        }
    }
    return false;
};