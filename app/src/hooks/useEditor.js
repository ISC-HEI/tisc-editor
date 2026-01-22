import { useEffect, useState } from "react";
import { refs, infos } from "./refs"
import { debounce } from "./useUtils"
import { fetchSvg, exportPdf, exportSvg } from "./useApi"

export let currentProjectId;
export let fileTree = { type: "folder", name: "root", children: {} };
export let currentFolderPath = "root";

const debounceFetchCompile = debounce(async () => {
    await fetchCompile();
    await autoSave();
});

// ----------------------------------------------------

function initEditor() {
    if (!refs.editor || !refs.btnBold || !refs.btnItalic || !refs.btnUnderline || !refs.page || !refs.btnSave || !refs.btnOpen || !refs.fileInputOpen || !refs.btnExportPdf || !refs.btnExportSvg || !refs.separator) {
        return
    }

    refs.editor.onDidChangeModelContent(() => { 
        debounceFetchCompile(); 
    });

    refs.btnBold.addEventListener('click', () => applyFormatting('bold'));
    refs.btnItalic.addEventListener('click', () => applyFormatting('italic'));
    refs.btnUnderline.addEventListener('click', () => applyFormatting('underline'));
    refs.btnSave.addEventListener('click', downloadDocument);
    refs.btnOpen.addEventListener('click', () => refs.fileInputOpen.click());
    refs.fileInputOpen.addEventListener('change', openAndShowFile);

    refs.btnExportPdf.addEventListener('click', () => {exportPdf(refs.editor.getValue(), { children: fileTree.children })})
    refs.btnExportSvg.addEventListener('click', async () => {exportSvg(await fetchSvg(refs.editor.getValue(), { children: fileTree.children }))})

    setupResizable();

    if (!infos.currentProjectId || !infos.defaultFileTree) {
        return
    }
    currentProjectId=infos.currentProjectId
    fileTree=infos.defaultFileTree
    fetchCompile();

    return true
}

export function useEditorWatcher() {
    const [initialized, setInitialized] = useState(false);
    useEffect(() => {
        const success = initEditor();
        
        if (!success && !initialized) {
            const interval = setInterval(() => {
                if (initEditor()) {
                    setInitialized(true);
                    clearInterval(interval);
                }
            }, 100);
            return () => clearInterval(interval);
        }

        return () => {
            if (refs.btnBold) refs.btnBold.onclick = null;
            if (refs.btnItalic) refs.btnItalic.onclick = null;
            if (refs.btnUnderline) refs.btnUnderline.onclick = null;
            if (refs.btnSave) refs.btnSave.onclick = null;
            if (refs.btnExportPdf) refs.btnExportPdf = null
            if (refs.btnExportSvg) refs.btnExportSvg = null
        };
    }, []);
}

// ----------------------------------------------------

async function applyFormatting(type) {
    const delimiters = {
        bold: ["*", "*"],
        italic: ["_", "_"],
        underline: ["#underline[", "]"]
    }[type];

    if (!delimiters || !refs.editor) return;

    const selection = refs.editor.getSelection();
    const model = refs.editor.getModel();
    const selectedText = model.getValueInRange(selection);

    if (selectedText === "") return;

    const newText = `${delimiters[0]}${selectedText}${delimiters[1]}`;

    refs.editor.executeEdits("format", [{
        range: selection,
        text: newText,
        forceMoveMarkers: true
    }]);

    await fetchCompile();
    await autoSave();
}

// ----------------------------------------------------

export async function fetchCompile() {
    refs.page.innerHTML = `
        <div class="flex items-center justify-center min-h-screen w-full bg-gray-100">
            
            <div class="relative">
                <div class="w-12 h-12 border-4 border-gray-200 rounded-full"></div>
                <div class="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>

        </div>
    `;
    const svg = await fetchSvg(refs.editor.getValue(), { children: fileTree.children });
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
        refs.page.innerText = message
    } else {
        refs.page.innerHTML = svg
    }
}

// ----------------------------------------------------

export function downloadDocument() {
    const content = refs.editor.getValue();
    if (!content) return;

    const blob = new Blob([content], { type: "text/plain" });
    const filename = `${new Date().toISOString().replace(/[-:.]/g,'')}_typstDocument.typ`;
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

// ----------------------------------------------------

async function openAndShowFile() {
    const file = refs.fileInputOpen.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => { refs.editor.setValue(e.target.result);; fetchCompile(); };
    reader.readAsText(file);
    await autoSave();
}

// ----------------------------------------------------

async function autoSave() {
    if (!currentProjectId) return;

    const content = refs.editor.getValue();
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

// ----------------------------------------------------
let isDragging = false;
let container;

function setupResizable() {
    if (!refs.separator) return;

    container = refs.separator.parentElement;

    refs.separator.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !container) return;

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
}