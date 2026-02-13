import { useEffect, useState } from "react";
import { refs, infos } from "./refs"
import { debounce, makeToast } from "./useUtils"
import { fetchSvg, exportPdf, exportSvg } from "./useApi"

export let currentProjectId;
export let fileTree = { type: "folder", name: "root", children: {} };
export let currentFolderPath = "root";
export let currentFilePath = "root/main.typ"
export let isLoadingFile = false;

const BANNED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'ttf', 'otf', 'zip', 'svg'];
const ALWAYS_ALLOWED = ['typ', 'json', 'txt', 'md', 'js', 'css', 'py', 'sh'];

const debounceFetchCompile = debounce(async () => {
    if (isLoadingFile) return;

    syncFileTreeWithEditor();
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

    refs.btnExportPdf.addEventListener('click', () => {
        const mainNode = fileTree.children["main.typ"];
        if (mainNode) {
            mainNode.data = refs.editor.getValue();
        }
        exportPdf(fileTree);
    });

    refs.btnExportSvg.addEventListener('click', async () => {
        exportSvg(await fetchSvg({ children: fileTree.children }));
    });

    setupResizable();

    if (!infos.currentProjectId || !infos.defaultFileTree) {
        return
    }
    currentProjectId = infos.currentProjectId;
    fileTree = infos.defaultFileTree;
    fetchCompile();

    return true;
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
            if (refs.btnExportPdf) refs.btnExportPdf = null;
            if (refs.btnExportSvg) refs.btnExportSvg = null;
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
    const svg = await fetchSvg({ children: fileTree.children });
    if (svg.startsWith("{")) {
        let error = JSON.parse(svg);
        let errorDetails = error.details ? error.details.split(": ")[1] : "";
        let message = "";

        if (errorDetails.includes("file not found")) {
            const messageDetails = errorDetails.split(" (")[0];
            let errorSuppDetail = "";
            if (messageDetails.includes("file not found")) {
                const match = errorDetails.match(/\(([^)]+)\)/);
                const insideParentheses = match ? match[1] : "";
                errorSuppDetail = insideParentheses.split("/app")[1] || "unknown path";
            } else {
                errorSuppDetail = errorDetails;
            }
            message = `${error.error}, ${messageDetails} (${errorSuppDetail})`;
        } else {
            message = `${error.error}`;
        }
        refs.page.innerText = message;
    } else {
        refs.page.innerHTML = svg;
    }
}

// ----------------------------------------------------

export function downloadDocument() {
    const content = refs.editor.getValue();
    if (!content) return;

    const blob = new Blob([content], { type: "text/plain" });
    const filename = `${new Date().toISOString().replace(/[-:.]/g, '')}_typstDocument.typ`;
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
    reader.onload = (e) => {
        refs.editor.setValue(e.target.result);
        fetchCompile();
    };
    reader.readAsText(file);
    await autoSave();
}

// ----------------------------------------------------

async function autoSave() {
    if (!currentProjectId) return;

    syncFileTreeWithEditor();

    try {
        await fetch('/api/projects/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: currentProjectId,
                fileTree: fileTree
            })
        });
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

// ----------------------------------------------------

export function openFile(path) {
    if (!path || !refs.editor) return;

    const parts = path.replace("root/", "").split("/");
    let node = fileTree;
    for (const part of parts) {
        if (node && node.children) node = node.children[part];
    }

    if (!node || node.type === "folder") return;

    const ext = node.name.split(".").pop().toLowerCase();

    if (BANNED_EXTENSIONS.includes(ext)) {
        makeToast(`Interrupted: .${ext} is a binary file.`, "error")
        return;
    }

    if (!ALWAYS_ALLOWED.includes(ext)) {
        const confirmForce = window.confirm(
            `Unknown extension .${ext}. \n\nOpening this as text might corrupt the file if it's not a plain text format. Do you want to proceed?`
        );
        if (!confirmForce) return;
    }

    const lang = getEditorLanguage(ext);
    const model = refs.editor.getModel();

    if (model) {
        refs.monaco.editor.setModelLanguage(model, lang)
    }

    isLoadingFile = true;
    currentFilePath = path;

    let content = node.data || "";

    if (node.name !== "main.typ" && content.startsWith('data:')) {
        try {
            const base64 = content.split(',')[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            content = new TextDecoder().decode(bytes);
        } catch (e) {
            console.error("Erreur décodage fichier secondaire:", e);
        }
    }

    refs.editor.setValue(content);

    setTimeout(() => {
        isLoadingFile = false;
    }, 150);
}

// ----------------------------------------------------

export function syncFileTreeWithEditor() {
    if (!refs.editor || !currentFilePath || isLoadingFile) return;

    const content = refs.editor.getValue();
    const parts = currentFilePath.replace("root/", "").split("/");
    let node = fileTree;

    for (const part of parts) {
        if (node && node.children && node.children[part]) {
            node = node.children[part];
        } else {
            return;
        }
    }

    if (node && node.type === "file") {
        if (node.name === "main.typ") {
            node.data = content;
        } else {
            const bytes = new TextEncoder().encode(content);
            const binary = String.fromCharCode(...bytes);
            node.data = "data:text/plain;base64," + btoa(binary);
        }
    }
}

// ----------------------------------------------------

function getEditorLanguage(extension) {
    if (!extension) return "plaintext";
    const ext = extension.toLowerCase();

    switch (ext) {
        case "typ":
            return "typst";
        case "json":
            return "json";
        case "yml":
        case "yaml":
            return "yaml";
        case "py":
            return "python";
        case "js":
        case "mjs":
        case "cjs":
            return "javascript";
        case "ts":
            return "typescript";
        case "html":
        case "htm":
            return "html";
        case "css":
            return "css";
        case "md":
        case "markdown":
            return "markdown";
        case "sh":
        case "bash":
            return "shell";
        case "sql":
            return "sql";
        case "cpp":
        case "cc":
        case "cxx":
            return "cpp";
        case "c":
            return "c";
        case "rs":
            return "rust";
        case "go":
            return "go";
        default:
            return "plaintext";
    }
}