import { useEffect, useState } from "react";

import { createElement, FileJson, Book, FileCode, Image, FileQuestion, Folder, Terminal, Notebook } from 'lucide';
import { refs, functions } from "@/hooks/refs"
import { currentProjectId, fetchCompile, fileTree, openFile } from "./useEditor";
import { makeToast } from "./useUtils";

let selectedFolderPath = "root"

function initFileManager() {
    if (!refs.imageList || !refs.btnShowImages || !refs.imageExplorer || !refs.btnCloseImages || !functions.openCustomPrompt || !refs.btnUploadImages || !refs.imageFilesInput || !refs.rootDropZone || !refs.btnCreateFile) {
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

    renderFileExplorer(fileTree);

    return true;
}

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
            return () => clearInterval(interval);
        }

        return () => {
        };
    }, []);
}

// ----------------------------------------------------

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

export function renderFileExplorer(folder, container = refs.imageList, path="") {
    container.innerHTML = "";
    renderTreeRecursive(folder, container, path);
}

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

        itemRow.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            showContextMenu(e, fullPath, item.type); 
        });

        const fullPath = path ? `${path}/${item.name}` : item.name;

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
            
            li.addEventListener('dragover', e => {
                e.preventDefault();
                itemRow.style.background = "#eef";
            });
            li.addEventListener('dragleave', () => {
                itemRow.style.background = "transparent";
            });
            li.addEventListener('drop', e => {
                e.preventDefault();
                itemRow.style.background = "transparent";
                const sourcePath = e.dataTransfer.getData("path");
                moveItem(sourcePath, fullPath, fileTree);
            });

            itemRow.addEventListener("click", (e) => {
                e.stopPropagation();
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
            const iconHTML = getIcon(item.name);
            itemRow.innerHTML = `${iconHTML} <span>${item.name}</span>`;
            itemRow.addEventListener("click", (e) => {
                e.stopPropagation();
                openFile(fullPath);
            });
            li.appendChild(itemRow);
        }

        container.appendChild(li);
    });
}

// ----------------------------------------------------

async function moveItem(sourcePath, destFolderPath, fileTree) {
    if (destFolderPath.startsWith(sourcePath)) return;

    const srcParts = sourcePath.split("/").filter(x=>x);
    const name = srcParts[srcParts.length-1];
    const sourceParentPath = srcParts.slice(0,-1).join("/") || "root";
    const sourceParent = getFolder(fileTree, sourceParentPath);
    const destFolder = getFolder(fileTree, destFolderPath);

    if (!sourceParent || !destFolder) return;

    const item = sourceParent.children[name];
    if (!item) return;

    delete sourceParent.children[name];
    
    updatePaths(item, destFolderPath);
    if (destFolder.children[name]) {
        makeToast("A file with this name already exist in this folder", "error")
        return;
    }
    destFolder.children[name] = item;

    await saveFileTree();
    renderFileExplorer(fileTree);
    fetchCompile();
}

function updatePaths(item, newFolderPath) {
    if (item.type === "file") {
        item.fullPath = `${newFolderPath}/${item.name}`;
    } else if (item.type === "folder") {
        Object.values(item.children).forEach(child => updatePaths(child, `${newFolderPath}/${item.name}`));
    }
}

export async function deleteItem(path, fileTree) {
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('selected-item'));
    const parts = path.split("/").filter(x=>x);
    const name = parts[parts.length-1];
    const parentPath = parts.slice(0,-1).join("/") || "root";
    const parent = getFolder(fileTree, parentPath);

    if (!parent) return;

    delete parent.children[name];
    await saveFileTree();
    renderFileExplorer(fileTree);
    fetchCompile();
    selectedFolderPath = "root";
}

// ----------------------------------------------------

async function saveFileTree() {
    if (!currentProjectId) return;

    const currentFileTree = fileTree;

    try {
        await fetch('/api/projects/save', {
            method: 'POST',
            body: JSON.stringify({
                id: currentProjectId,
                fileTree: currentFileTree
            })
        });
        console.log("Projet sauvegardé...");
    } catch (err) {
        console.error("Erreur sauvegarde:", err);
    }
}

// ----------------------------------------------------

export function getIcon(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    
    const iconMap = {
        json: FileJson,
        typ: Book,
        tmtheme: Notebook,
        py: Terminal,
        js: FileCode,
        jpg: Image,
        png: Image,
        svg: Image
    };

    const IconData = iconMap[ext] || FileQuestion;

    const svgElement = createElement(IconData);
    
    svgElement.setAttribute('width', '18');
    svgElement.setAttribute('height', '18');
    svgElement.setAttribute('class', 'inline-block mr-2');
    svgElement.style.verticalAlign = "middle";

    return svgElement.outerHTML; 
}

// ----------------------------------------------------

async function createFile() {
    functions.openCustomPrompt("Enter new file name", async (fileName) => {
        if (!fileName || fileName.trim() === "") return;

        if (!fileName.includes('.')) {
            fileName += '.typ';
        }

        const targetFolder = getFolder(fileTree, selectedFolderPath);
        
        if (!targetFolder) {
            console.error("Target folder not found");
            return;
        }

        if (targetFolder.children[fileName]) {
            makeToast(`The name "${fileName}" is already taken in this folder.`, "error")
            return;
        }

        const newFilePath = selectedFolderPath === "root" 
            ? fileName 
            : `${selectedFolderPath}/${fileName}`;

        targetFolder.children[fileName] = {
            type: "file",
            name: fileName,
            fullPath: newFilePath,
            data: ""
        };

        renderFileExplorer(fileTree);

        await saveFileTree();

        openFile(newFilePath);
    });
}

// ----------------------------------------------------

function showContextMenu(e, path, type) {
    if (window.showContextMenu) {
        window.showContextMenu(e, path, type);
    } else {
        console.warn("React ContextMenu is not yet initialized.");
    }
}

export async function renameItem(oldPath) {
    const parts = oldPath.split("/").filter(x => x);
    const oldName = parts[parts.length - 1];
    
    functions.openCustomPrompt(`Rename "${oldName}" to:`, async (newName) => {
        if (!newName || newName === oldName) return;

        const parentPath = parts.slice(0, -1).join("/") || "root";
        const parent = getFolder(fileTree, parentPath);

        if (!parent || parent.children[newName]) {
            makeToast("A file or folder with this name already exists", "error");
            return;
        }

        const item = parent.children[oldName];
        
        delete parent.children[oldName];

        item.name = newName;
        const newFolderPath = parentPath === "root" ? "" : parentPath;
        updatePaths(item, newFolderPath);

        parent.children[newName] = item;

        await saveFileTree();
        renderFileExplorer(fileTree);
        makeToast("Item renamed successfully", "success");
    });
}