import { useEffect, useState } from "react";
import { createElement, FileJson, Book, FileCode, Image, FileQuestion, Folder, Terminal, Notebook } from 'lucide';
import { refs, functions, infos } from "@/hooks/refs"
import { currentProjectId, fetchCompile, fileTree, openAndShowFile, openFile, syncFileTreeWithEditor } from "./useEditor";
import { makeToast } from "./useUtils";
import JSZip from "jszip";

/** @type {string} Path of the folder currently selected for operations like file creation or upload. */
let selectedFolderPath = "root"

/** @type {string|null} Stores the path of the last item clicked or right-clicked for context actions (rename, delete). */
let lastClickedPath = null;

/**
 * Adds a new node (file or folder) to the local file tree structure.
 * @param {Object} root - The root object of the file tree.
 * @param {string} path - The full destination path starting with "root/".
 * @param {'file'|'folder'} type - The type of the node.
 * @param {string} [data=""] - The content or Base64 data if it's a file.
 */
export const addNodeToLocalTree = (root, path, type, data = "") => {
    const cleanPath = path.replace(/^root\//, "");
    const parts = cleanPath.split("/").filter(x => x);
    const fileName = parts.pop();
    let current = root;

    for (const part of parts) {
        if (!current.children[part]) {
            current.children[part] = { name: part, type: 'folder', children: {} };
        }
        current = current.children[part];
    }

    current.children[fileName] = {
        name: fileName,
        type: type,
        fullPath: path.replace(/^root\//, ""),
        data: type === 'file' ? data : null,
        children: type === 'folder' ? {} : null
    };
};

/**
 * Removes a node from the local tree based on its path.
 * @param {Object} root - The root object of the file tree.
 * @param {string} path - The full path of the item to delete.
 */
export const deleteNodeFromLocalTree = (root, path) => {
    const cleanPath = path.replace(/^root\//, "");
    const parts = cleanPath.split("/").filter(x => x);
    const fileName = parts.pop();
    let current = root;

    for (const part of parts) {
        if (current && current.children) {
            current = current.children[part];
        }
    }

    if (current && current.children) {
        delete current.children[fileName];
    }
};

/**
 * Renames or moves a node by copying its data, deleting the old entry, 
 * and creating a new one at the target path.
 * @param {Object} root - The root object of the file tree.
 * @param {string} oldPath - Current path of the node.
 * @param {string} newPath - New target path for the node.
 */
export const renameNodeInLocalTree = (root, oldPath, newPath) => {
    const findNode = (p) => {
        const cleanP = p.replace(/^root\//, "");
        const parts = cleanP.split("/").filter(x => x);
        let curr = root;
        for (const part of parts) {
            if (curr && curr.children) curr = curr.children[part];
        }
        return curr;
    };

    const nodeToMove = findNode(oldPath);
    if (nodeToMove) {
        const dataCopy = JSON.parse(JSON.stringify(nodeToMove));
        deleteNodeFromLocalTree(root, oldPath);
        addNodeToLocalTree(root, newPath, dataCopy.type, dataCopy.data);
        const newNode = findNode(newPath);
        if (dataCopy.type === 'folder') newNode.children = dataCopy.children;
    }
};

/**
 * Initializes listeners for file management UI components (Upload, Create, Drag & Drop).
 * Checks if all required DOM references are available before binding events.
 * @returns {boolean} True if listeners were successfully attached.
 */
function initFileManager() {
    if (!refs.imageList || !refs.btnShowImages || !refs.imageExplorer || !refs.btnCloseImages || !functions.openCustomPrompt || !refs.btnUploadImages || !refs.imageFilesInput || !refs.rootDropZone || !refs.btnCreateFile || !refs.btnExportZip) {
        return false;
    }
    refs.btnShowImages.addEventListener("click", () => {
        refs.imageExplorer.style.display = "block"
    });

    refs.btnCloseImages.addEventListener("click", () => {
        refs.imageExplorer.style.display = "none";
    })

    refs.btnCreateFolder.addEventListener("click", () => {
        functions.openCustomPrompt(`Create new folder in ${selectedFolderPath}`, async (folderName) => {

            if (!folderName) return;

            const targetFolder = getFolder(fileTree, selectedFolderPath);
            if (targetFolder) {
                if (!targetFolder.children[folderName]) {
                    targetFolder.children[folderName] = {
                        type: "folder",
                        name: folderName,
                        children: {}
                    };
                    renderFileExplorer(fileTree);
                    await saveFileTree();
                    
                    if (refs.socket?.connected) {
                        const socketPath = selectedFolderPath === "root" ? `root/${folderName}` : `root/${selectedFolderPath}/${folderName}`;
                        refs.socket.emit('create-node', { docId: currentProjectId, path: socketPath, type: 'folder' });
                    }
                    
                    selectedFolderPath = "root";
                }
            }
        });
    });

    refs.btnUploadImages.addEventListener("click", (e) => {
        e.preventDefault();
        refs.imageFilesInput.click();
    });

    refs.imageFilesInput.addEventListener("change", (event) => {
        const files = Array.from(event.target.files);
        const targetFolder = getFolder(fileTree, selectedFolderPath);

        if (!targetFolder) {
            alert("Invalid target folder");
            return;
        }

        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                targetFolder.children[file.name] = {
                    type: "file",
                    name: file.name,
                    fullPath: selectedFolderPath === "root" ? file.name : `${selectedFolderPath}/${file.name}`,
                    data: e.target.result
                };
                await saveFileTree();
                renderFileExplorer(fileTree);
                fetchCompile();

                if (refs.socket?.connected) {
                    const socketPath = selectedFolderPath === "root" ? `root/${file.name}` : `root/${selectedFolderPath}/${file.name}`;
                    refs.socket.emit('create-node', { docId: currentProjectId, path: socketPath, type: 'file' });
                }
            };
            reader.readAsDataURL(file);
        });
    });

    refs.rootDropZone.addEventListener("click", () => {
        document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('selected-item'));
        selectedFolderPath = "root";
    });

    refs.rootDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        refs.rootDropZone.style.background = "#eef";
    });

    refs.rootDropZone.addEventListener("dragleave", () => {
        refs.rootDropZone.style.background = "transparent";
    });

    refs.rootDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        refs.rootDropZone.style.background = "transparent";

        const sourcePath = e.dataTransfer.getData("path");
        moveItem(sourcePath, "root", fileTree);
    });

    refs.btnCreateFile.addEventListener("click", createFile)

    refs.btnExportZip.addEventListener("click", () => {
        exportZip(fileTree, infos.title || "unknow_project")
    })

    renderFileExplorer(fileTree);

    return true;
}

/**
 * React hook that ensures the File Manager is initialized and sets up 
 * global keyboard shortcuts (e.g., F2 for renaming).
 */
export function useFileManagerWatcher() {
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        const success = initFileManager();

        if (!success && !initialized) {
            const interval = setInterval(() => {
                if (initFileManager()) {
                    setInitialized(true);
                    clearInterval(interval);
                }
            }, 100);
        }

        const handleGlobalKeyDown = (e) => {
            if (e.key === "F2") {
                const pathToRename = lastClickedPath || (typeof currentFilePath !== 'undefined' ? currentFilePath : null);

                if (pathToRename) {
                    e.preventDefault();
                    renameItem(pathToRename);
                }
            }
        };

        window.addEventListener("keydown", handleGlobalKeyDown);

        return () => {
            window.removeEventListener("keydown", handleGlobalKeyDown);
        };
    }, [initialized]);
}

// ----------------------------------------------------

/**
 * Recursively traverses the tree to find a folder node at a specific path.
 * @param {Object} fileTree - The root tree to search in.
 * @param {string} path - The relative path from root.
 * @returns {Object|null} The folder node object or null if not found.
 */
export function getFolder(fileTree, path) {
    if (path === "root") return fileTree;

    const parts = path.split("/");
    let curr = fileTree;

    for (const part of parts) {
        if (!curr.children[part] || curr.children[part].type !== "folder") {
            return null;
        }
        curr = curr.children[part];
    }
    return curr;
}

// ----------------------------------------------------

/**
 * Clears and re-renders the file explorer UI based on the current file tree state.
 * @param {Object} folder - The folder node to render.
 * @param {HTMLElement} container - The DOM element to inject the list into.
 * @param {string} [path=""] - Current recursion path for nested items.
 */
export function renderFileExplorer(folder, container = refs.imageList, path = "") {
    if (!container) return;
    container.innerHTML = "";
    renderTreeRecursive(folder, container, path);
}

/**
 * Core recursive engine that builds the DOM elements for the file tree.
 * Handles drag events, click listeners, and image hover previews.
 * @param {Object} folder - Current folder node being rendered.
 * @param {HTMLElement} container - The UL/DIV where items are appended.
 * @param {string} path - The accumulated path string for recursion.
 */
function renderTreeRecursive(folder, container, path) {
    Object.values(folder.children).forEach(item => {
        const li = document.createElement("li");
        li.style.listStyle = "none";

        li.draggable = true;

        const itemRow = document.createElement("div");
        itemRow.style.display = "flex";
        itemRow.style.alignItems = "center";
        itemRow.style.gap = "8px";
        itemRow.style.cursor = "grab";
        itemRow.classList.add("tree-item-row");

        const fullPath = path ? `${path}/${item.name}` : item.name;

        itemRow.addEventListener("contextmenu", (e) => {
            e.preventDefault();

            document.querySelectorAll('.tree-item-row').forEach(el => el.classList.remove('selected-item'));
            itemRow.classList.add('selected-item');
            lastClickedPath = fullPath;

            showContextMenu(e, fullPath, item.type);
        });

        li.addEventListener('dragstart', e => {
            e.dataTransfer.setData("path", fullPath);
            e.stopPropagation();
            li.style.opacity = "0.5";
        });

        li.addEventListener('dragend', () => {
            li.style.opacity = "1";
        });

        if (item.type === "folder") {
            const folderIcon = createElement(Folder);
            folderIcon.setAttribute('width', '18');
            folderIcon.setAttribute('height', '18');

            itemRow.innerHTML = `${folderIcon.outerHTML} <strong>${item.name}</strong>`;

            li.addEventListener('dragover', e => { e.preventDefault(); itemRow.style.background = "#eef"; });
            li.addEventListener('dragleave', () => itemRow.style.background = "transparent");
            li.addEventListener('drop', e => {
                e.preventDefault();
                itemRow.style.background = "transparent";
                const sourcePath = e.dataTransfer.getData("path");
                moveItem(sourcePath, fullPath, fileTree);
            });

            itemRow.addEventListener("click", (e) => {
                e.stopPropagation();
                lastClickedPath = fullPath;
                document.querySelectorAll('.tree-item-row').forEach(el => el.classList.remove('selected-item'));
                itemRow.classList.add('selected-item');
                selectedFolderPath = fullPath;
            });

            li.appendChild(itemRow);

            const ul = document.createElement("ul");
            ul.style.marginLeft = "20px";
            li.appendChild(ul);
            renderTreeRecursive(item, ul, fullPath);

        } else {
            const iconHTML = getIcon(item.name, item.isMain);
            itemRow.innerHTML = `${iconHTML} <span>${item.name}</span>`;

            const ext = item.name.split('.').pop().toLowerCase();
            const isStandardImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

            if (isStandardImage && item.data) {
                itemRow.addEventListener("mouseenter", (e) => {
                    const preview = document.createElement("div");
                    preview.id = "image-hover-preview";
                    
                    Object.assign(preview.style, {
                        position: 'fixed',
                        left: `${e.clientX + 20}px`,
                        top: `${e.clientY - 20}px`,
                        zIndex: '1000',
                        padding: '4px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
                        pointerEvents: 'none'
                    });

                    preview.innerHTML = `
                        <img src="${item.data}" 
                            style="max-width: 200px; max-height: 200px; display: block; border-radius: 4px;" 
                        />`;
                    document.body.appendChild(preview);
                });

                itemRow.addEventListener("mousemove", (e) => {
                    const preview = document.getElementById("image-hover-preview");
                    if (preview) {
                        preview.style.left = `${e.clientX + 20}px`;
                        preview.style.top = `${e.clientY - 20}px`;
                    }
                });

                itemRow.addEventListener("mouseleave", () => {
                    const preview = document.getElementById("image-hover-preview");
                    if (preview) preview.remove();
                });
            }

            itemRow.addEventListener("click", (e) => {
                e.stopPropagation();
                lastClickedPath = fullPath;
                document.querySelectorAll('.tree-item-row').forEach(el => el.classList.remove('selected-item'));
                itemRow.classList.add('selected-item');
                openFile(fullPath);
            });
            li.appendChild(itemRow);
        }

        container.appendChild(li);
    });
}

// ----------------------------------------------------

/**
 * Logic for moving an item between folders. Updates internal paths,
 * triggers a re-render, saves to DB, and broadcasts via Socket.IO.
 */
async function moveItem(sourcePath, destFolderPath, fileTree) {
    if (destFolderPath.startsWith(sourcePath)) return;

    const srcParts = sourcePath.split("/").filter(x => x);
    const name = srcParts[srcParts.length - 1];
    const sourceParentPath = srcParts.slice(0, -1).join("/") || "root";
    const sourceParent = getFolder(fileTree, sourceParentPath);
    const destFolder = getFolder(fileTree, destFolderPath);

    if (!sourceParent || !destFolder) return;

    const item = sourceParent.children[name];
    if (!item) return;

    if (destFolder.children[name]) {
        makeToast("A file with this name already exist in this folder", "error")
        return;
    }

    delete sourceParent.children[name];
    updatePaths(item, destFolderPath);
    destFolder.children[name] = item;

    await saveFileTree();
    renderFileExplorer(fileTree);
    fetchCompile();

    if (refs.socket?.connected) {
        const oldSocketPath = `root/${sourcePath}`;
        const newSocketPath = `root/${destFolderPath === "root" ? "" : destFolderPath + "/"}${name}`;
        refs.socket.emit('rename-node', { docId: currentProjectId, oldPath: oldSocketPath, newPath: newSocketPath });
    }
}

/**
 * Recursively updates the 'fullPath' property of a node and all its children.
 * Necessary after a move or rename operation to maintain tree integrity.
 * @param {Object} item - The node (file or folder) to update.
 * @param {string} newFolderPath - The new parent folder path.
 */
function updatePaths(item, newFolderPath) {
    if (item.type === "file") {
        item.fullPath = newFolderPath === "root" ? item.name : `${newFolderPath}/${item.name}`;
    } else if (item.type === "folder") {
        Object.values(item.children).forEach(child => updatePaths(child, newFolderPath === "root" ? item.name : `${newFolderPath}/${item.name}`));
    }
}

/**
 * Permanently deletes an item, updates the UI, and notifies collaborative peers.
 * @param {string} path - Path of the item to delete.
 * @param {Object} fileTree - Reference to the global file tree.
 */
export async function deleteItem(path, fileTree) {
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('selected-item'));
    const parts = path.split("/").filter(x => x);
    const name = parts[parts.length - 1];
    const parentPath = parts.slice(0, -1).join("/") || "root";
    const parent = getFolder(fileTree, parentPath);

    if (!parent || !parent.children[name]) return;

    if (parent.children[name].type === "file" && parent.children[name].isMain) {
        makeToast("Cannot delete the main file. Set another file as main first.", "error");
        return;
    }

    delete parent.children[name];
    await saveFileTree();
    renderFileExplorer(fileTree);
    fetchCompile();
    selectedFolderPath = "root";

    if (refs.socket?.connected) {
        refs.socket.emit('delete-node', { docId: currentProjectId, path: `root/${path}` });
    }
}

// ----------------------------------------------------

/**
 * Persists the current state of the file tree to the server database.
 * @async
 */
async function saveFileTree() {
    if (!currentProjectId) return;
    try {
        await fetch('api/projects/save', {
            method: 'POST',
            body: JSON.stringify({ id: currentProjectId, fileTree: fileTree })
        });
    } catch (err) {
        console.error("Erreur sauvegarde:", err);
    }
}

// ----------------------------------------------------

/**
 * Maps a file extension to a specific Lucide icon and returns its HTML string.
 * @param {string} filename - The name of the file to determine the icon for.
 * @returns {string} The HTML string of the rendered SVG icon.
 */
export function getIcon(filename, isMain) {
    const ext = filename.split(".").pop().toLowerCase();
    const iconMap = { json: FileJson, typ: Book, tmtheme: Notebook, py: Terminal, js: FileCode, jpg: Image, png: Image, svg: Image };
    const IconData = iconMap[ext] || FileQuestion;

    const svgElement = createElement(IconData);

    svgElement.setAttribute('width', '18');
    svgElement.setAttribute('height', '18');
    if (isMain) {
        svgElement.setAttribute('stroke', '#3b82f6');
        svgElement.setAttribute('class', 'inline-block mr-2 font-bold');
    } else {
        svgElement.setAttribute('class', 'inline-block mr-2');
    }
    svgElement.style.verticalAlign = "middle";

    return svgElement.outerHTML;
}

// ----------------------------------------------------

/**
 * Triggers a prompt to create a new file in the currently selected folder.
 * Automatically appends '.typ' if no extension is provided.
 * @async
 */
async function createFile() {
    functions.openCustomPrompt("Enter new file name", async (fileName) => {
        if (!fileName || fileName.trim() === "") return;

        if (!fileName.includes('.')) {
            fileName += '.typ';
        }

        const targetFolder = getFolder(fileTree, selectedFolderPath);
        if (!targetFolder || targetFolder.children[fileName]) {
            makeToast(`Error creating file`, "error")
            return;
        }

        const newFilePath = selectedFolderPath === "root" ? fileName : `${selectedFolderPath}/${fileName}`;
        targetFolder.children[fileName] = { type: "file", name: fileName, fullPath: newFilePath, data: "" };

        renderFileExplorer(fileTree);

        await saveFileTree();

        openFile(newFilePath);

        if (refs.socket?.connected) {
            const socketPath = selectedFolderPath === "root" ? `root/${fileName}` : `root/${selectedFolderPath}/${fileName}`;
            refs.socket.emit('create-node', { docId: currentProjectId, path: socketPath, type: 'file' });
        }
    });
}

// ----------------------------------------------------

/**
 * Triggers the custom context menu at the mouse position.
 * @param {MouseEvent} e - The original click event.
 * @param {string} path - The path of the item targeted by the right-click.
 * @param {'file'|'folder'} type - The type of the targeted item.
 */
function showContextMenu(e, path, type) {
    if (window.showContextMenu) window.showContextMenu(e, path, type);
}

/**
 * Opens a prompt to rename an existing file or folder. 
 * Updates the tree, saves the state, and notifies other users via Socket.IO.
 * @param {string} oldPath - The current path of the item to be renamed.
 */
export async function renameItem(oldPath) {
    const parts = oldPath.split("/").filter(x => x);
    const oldName = parts[parts.length - 1];

    functions.openCustomPrompt(`Rename "${oldName}" to:`, async (newName) => {
        if (!newName || newName === oldName) return;

        const parentPath = parts.slice(0, -1).join("/") || "root";
        const parent = getFolder(fileTree, parentPath);

        if (!parent || parent.children[newName]) {
            makeToast("Error renaming", "error");
            return;
        }

        const item = parent.children[oldName];

        delete parent.children[oldName];

        item.name = newName;
        updatePaths(item, parentPath);
        parent.children[newName] = item;

        await saveFileTree();
        renderFileExplorer(fileTree);
        
        if (refs.socket?.connected) {
            const oldSocketPath = `root/${oldPath}`;
            const newSocketPath = `root/${parentPath === "root" ? "" : parentPath + "/"}${newName}`;
            refs.socket.emit('rename-node', { docId: currentProjectId, oldPath: oldSocketPath, newPath: newSocketPath });
        }
    });
}

/**
 * Packages the entire project structure into a .zip file and triggers a download.
 * Handles both plain text and Base64 encoded (image) data.
 * @param {Object} fileTree - The project structure to export.
 * @param {string} projectName - The name of the resulting zip file.
 */
export async function exportZip(fileTree, projectName = "project") {
    const zip = new JSZip();
    zipContent(zip, fileTree);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    makeToast("Project exported", "success");
}

/**
 * Recursively traverses the file tree to populate a JSZip instance.
 * @param {Object} zip - The current JSZip folder instance.
 * @param {Object} folder - The local folder node to process.
 */
function zipContent(zip, folder) {
    Object.values(folder.children).forEach(item => {
        if (item.type === "folder") {
            zipContent(zip.folder(item.name), item);
        } else {
            let data = item.data;
            if (typeof data === "string" && data.startsWith("data:")) {
                zip.file(item.name, data.split(",")[1], { base64: true });
            } else {
                zip.file(item.name, data || "");
            }
        }
    });
}

/**
 * Set a file as the main entry point for compilation and export
 * @param {string} path The path of the new entry point
 * @param {*} root The file tree
 */
export async function setMainFile(path, root) {
    syncFileTreeWithEditor();

    const clearMain = (node) => {
        if (node.type === "file") {
            node.isMain = false;
        } else if (node.children) {
            Object.values(node.children).forEach(clearMain);
        }
    };

    clearMain(root);

    const parts = path.split("/").filter(x => x);
    let current = root;
    const fileName = parts.pop();

    for (const part of parts) {
        current = current.children[part];
    }

    if (current.children[fileName]) {
        current.children[fileName].isMain = true;
        makeToast(`${fileName} is now the main file`, "success");
    }

    if (refs.socket?.connected) {
        refs.socket.emit('set-main-file', { 
            docId: currentProjectId, 
            path: path 
        });
    }

    await saveFileTree();
    openFile(path)
    renderFileExplorer(fileTree);
}