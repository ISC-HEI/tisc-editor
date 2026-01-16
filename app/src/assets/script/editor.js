import { fetchSvg, exportPdf, exportSvg } from './api.js';
import { debounce } from './utils.js';

export let fileTree = { type: "folder", name: "root", children: {} };
export let currentFolderPath = "root";

// ---------- Editor elements ----------
let editor;
const page = document.getElementById("page");
export let currentProjectId;
export const uploadedImages = {};

// ---------- Formatting functions ----------
export function applyFormatting(type) {
    const delimiters = {
        bold: ["*", "*"],
        italic: ["_", "_"],
        underline: ["#underline[", "]"]
    }[type];

    if (!delimiters || !editor) return;

    const selection = editor.getSelection();
    const model = editor.getModel();
    const selectedText = model.getValueInRange(selection);

    if (selectedText === "") return;

    const newText = `${delimiters[0]}${selectedText}${delimiters[1]}`;

    editor.executeEdits("format", [{
        range: selection,
        text: newText,
        forceMoveMarkers: true
    }]);

    fetchCompile();
    autoSave();
}

// ---------- Main compile function ----------
export async function fetchCompile() {
    page.innerHTML = `
        <div class="loading-wrapper">
            <div class="spinner"></div>
        </div>
    `;
    const svg = await fetchSvg(editor.getValue(), { children: fileTree.children });
    if (svg.startsWith("{")) {
        let error = JSON.parse(svg)
        let errorDetails = error.details ? error.details.split(": ")[1] : ""
        let message = ""

        if (errorDetails.includes("file not found")) {

            const messageDetails = errorDetails.split(" (")[0];
            
            let errorSuppDetail = ""
            if (messageDetails.includes("file not found")) {
                const match = errorDetails.match(/\(([^)]+)\)/);
                const insideParentheses = match ? match[1] : "";
                
                errorSuppDetail = insideParentheses.split("/app")[1] || "unknown path";
            } else {
                errorSuppDetail=errorDetails
            }   
            message = `${error.error}, ${messageDetails} (${errorSuppDetail})`
        } else {
            message = `${error.error}, ${error.details}`
        }
        page.innerText = message
    } else {
        page.innerHTML = svg
    }
}

// ---------- File operations ----------
export function downloadDocument() {
    const content = editor.getValue();
    if (!content) return;

    const blob = new Blob([content], { type: "text/plain" });
    const filename = `${new Date().toISOString().replace(/[-:.]/g,'')}_typstDocument.typ`;
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

// ---------- Event listeners ----------
export function initEditorListeners(monaco, projectId, fileTreeLoad, btnBold, btnItalic, btnUnderline, btnSave, btnOpen, fileInput, btnExportPdf, btnExportSvg) {
    currentProjectId = projectId
    fileTree=fileTreeLoad
    editor = monaco
    editor.onDidChangeModelContent(() => { 
        debounceFetchCompile(); 
    });

    btnBold.addEventListener('click', () => applyFormatting('bold'));
    btnItalic.addEventListener('click', () => applyFormatting('italic'));
    btnUnderline.addEventListener('click', () => applyFormatting('underline'));
    
    btnSave.addEventListener('click', downloadDocument);
    btnOpen.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', openAndShowFile);

    btnExportPdf.addEventListener('click', () => exportPdf(editor.getValue(), { children: fileTree.children }));
    btnExportSvg.addEventListener('click', async () => exportSvg(await fetchSvg(editor.getValue(), { children: fileTree.children })));
}

const debounceFetchCompile = debounce(async () => {
    await fetchCompile();
    await autoSave();
});

// Open a local file
async function openAndShowFile() {
    const file = fileInput.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => { editor.setValue(e.target.result);; fetchCompile(); };
    reader.readAsText(file);
    await autoSave();
}


// -------- Change pages size --------
const separator = document.getElementById('separator');
const container = separator.parentElement;

let isDragging = false;

separator.addEventListener('mousedown', (e) => {
    isDragging = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; 
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const containerRect = container.getBoundingClientRect();
    const relativeX = e.clientX - containerRect.left;

    const containerWidth = containerRect.width;
    let percentage = (relativeX / containerWidth) * 100;

    const editorSide = container.firstElementChild;
    
    editorSide.style.flex = `0 0 ${percentage}%`;
});

document.addEventListener('mouseup', () => {
    if (isDragging) {
        isDragging = false;
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    }
});

async function autoSave() {
    if (!currentProjectId) return;

    const content = editor.getValue();
    const currentFileTree = fileTree;

    try {
        await fetch('/api/projects/save', {
            method: 'POST',
            body: JSON.stringify({
                id: currentProjectId,
                content: content,
                fileTree: currentFileTree
            })
        });
        console.log("Projet sauvegardé...");
    } catch (err) {
        console.error("Erreur sauvegarde:", err);
    }
}