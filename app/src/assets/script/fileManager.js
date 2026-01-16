import { fetchCompile, fileTree, currentProjectId } from './editor.js';
import { createElement, FileJson, Book, FileCode, Image, FileQuestion, Folder, Terminal, Notebook } from 'lucide';

const imageList = document.getElementById('imageList');
const imageExplorer = document.getElementById("imageExplorer");
let selectedFolderPath = "root";

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

// Render explorer recursively
export function renderFileExplorer(folder, container = imageList, path="") {
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
                document.querySelectorAll('.tree-item-row').forEach(el => el.classList.remove('selected-folder'));
                itemRow.classList.add('selected-folder');
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
            li.appendChild(itemRow);
        }

        const btnDelete = document.createElement("button");
        btnDelete.textContent = "x";
        btnDelete.classList.add("btn-delete");
        btnDelete.style.marginLeft = "auto";
        btnDelete.setAttribute("draggable", "false"); 
        
        btnDelete.onclick = (e) => {
            e.stopPropagation();
            deleteItem(fullPath, fileTree);
        };

        itemRow.appendChild(btnDelete);
        container.appendChild(li);
    });
}

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

export function initFileManager(btnShowImages, btnCloseImages, btnCreateFolder, btnUploadImages, imageFilesInput, rootDropZone, customPrompt) {
    btnShowImages.addEventListener("click", () => {
        imageExplorer.style.display = "block"
    });
    btnCloseImages.addEventListener("click", () => {
        imageExplorer.style.display = "none";        
    })
    rootDropZone.addEventListener("click", () => {
        document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('selected-folder'));
        selectedFolderPath = "root";
    });
btnCreateFolder.addEventListener("click", () => {
    customPrompt(`Create new folder in ${selectedFolderPath}`, async (folderName) => {
        
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
    btnUploadImages.addEventListener("click", (e) => {
        e.preventDefault();
        imageFilesInput.click();
    });
    imageFilesInput.addEventListener("change", (event) => {
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
    rootDropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        rootDropZone.style.background = "#eef";
    });

    rootDropZone.addEventListener("dragleave", () => {
        rootDropZone.style.background = "transparent";
    });

    rootDropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        rootDropZone.style.background = "transparent";

        const sourcePath = e.dataTransfer.getData("path");
        moveItem(sourcePath, "root", fileTree);
    });
    renderFileExplorer(fileTree);
}

async function deleteItem(path, fileTree) {
    document.querySelectorAll('.folder-item').forEach(el => el.classList.remove('selected-folder'));
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