import { useEffect, useState } from "react";
import { refs, infos } from "./refs"
import { addLogToPane, debounce, makeToast } from "./useUtils"
import { fetchSvg, exportPdf, exportSvg } from "./useApi"

export let currentProjectId;
export let fileTree = { type: "folder", name: "root", children: {} };
export let currentFolderPath = "root";
export let currentFilePath = "root/main.typ"
export let isLoadingFile = false;

let hasCompilationError = false;
let onPathChangeCallback = null;

const BANNED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'ttf', 'otf', 'zip', 'svg'];
const ALWAYS_ALLOWED = ['typ', 'json', 'txt', 'md', 'js', 'css', 'py', 'sh', 'scala'];

let handleExportPdf = null;
let handleExportSvg = null;

const debounceFetchCompile = debounce(async () => {
    if (isLoadingFile) return;
    syncFileTreeWithEditor();
    await fetchCompile();
    await autoSave();
});

export function setIsLoadingFile(value) {
    isLoadingFile = value;
}

function updateExportButtons() {
    if (refs.btnExportPdf) {
        refs.btnExportPdf.disabled = hasCompilationError;
        refs.btnExportPdf.style.opacity = hasCompilationError ? '0.5' : '1';
        refs.btnExportPdf.style.cursor = hasCompilationError ? 'not-allowed' : 'pointer';
    }
    if (refs.btnExportSvg) {
        refs.btnExportSvg.disabled = hasCompilationError;
        refs.btnExportSvg.style.opacity = hasCompilationError ? '0.5' : '1';
        refs.btnExportSvg.style.cursor = hasCompilationError ? 'not-allowed' : 'pointer';
    }
}

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

    if (!handleExportPdf) {
        handleExportPdf = () => {
            if (hasCompilationError) {
                makeToast("Cannot export: compilation has errors", "error");
                return;
            }
            exportPdf(fileTree);
        };
    }

    if (!handleExportSvg) {
        handleExportSvg = async () => {
            if (hasCompilationError) {
                makeToast("Cannot export: compilation has errors", "error");
                return;
            }
            fetchSvg(fileTree);
        };
    }

    refs.btnExportPdf.addEventListener('click', handleExportPdf);
    refs.btnExportSvg.addEventListener('click', handleExportSvg);

    setupResizable();
    updateExportButtons();

    if (infos.currentProjectId) {
        currentProjectId = infos.currentProjectId;
    }

    if (infos.defaultFileTree?.children) {
        fileTree = infos.defaultFileTree;
    } else {
        console.warn("No fileTree loaded → fallback empty project");
    }

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
            if (refs.btnExportPdf && handleExportPdf) {
                refs.btnExportPdf.removeEventListener('click', handleExportPdf);
            }
            if (refs.btnExportSvg && handleExportSvg) {
                refs.btnExportSvg.removeEventListener('click', handleExportSvg);
            }
        };
    }, []);
}

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

export async function fetchCompile() {
    if (!refs.page) return;

    refs.page.innerHTML = `
        <div class="flex items-center justify-center h-full w-full bg-gray-50/50">
            <div class="relative">
                <div class="w-10 h-10 border-4 border-slate-200 rounded-full"></div>
                <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
        </div>
    `;

    try {
        
        const raw = await fetchSvg(fileTree);

        if (!raw) {
            refs.page.innerHTML = `<div class="flex items-center justify-center h-full text-slate-400 text-sm italic">Empty project — start typing to preview.</div>`;
            return;
        }

        let result;
        try {
            result = JSON.parse(raw);
        } catch (parseError) {
            throw new Error(`Compilation API response is not valid JSON:\n${raw}`);
        }

        if (result.logs) {
            result.logs.forEach(log => addLogToPane(log));
            const hasError = result.logs.some(log => log.type === 'error');
            hasCompilationError = hasError;
            updateExportButtons();
            if (hasError) {
                window.dispatchEvent(new CustomEvent('open-log-pane'));
            }
        }

        if (result.success && result.svg) {
            hasCompilationError = false;
            updateExportButtons();
            refs.page.innerHTML = result.svg;
        } else {
            let errorMessage = "Unknown compilation error";
            if (result.logs) {
                const errorLog = result.logs.find(l => l.type === 'error');
                if (errorLog) errorMessage = errorLog.msg;
            }

            hasCompilationError = true;
            updateExportButtons();

            refs.page.innerHTML = `
                <div class="p-8 text-red-600 font-mono text-sm bg-red-50 h-full overflow-auto">
                    <div class="flex items-center gap-2 font-bold mb-4">
                        <span class="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] uppercase">Compilation Failed</span>
                    </div>
                    <div class="bg-white border border-red-200 rounded-lg p-4 shadow-sm">
                        <pre class="whitespace-pre-wrap leading-relaxed">${errorMessage}</pre>
                    </div>
                    <p class="mt-4 text-red-400 text-xs italic">Check the System Logs for more details.</p>
                </div>
            `;
        }
    } catch (err) {
        console.error("Critical Fetch Error:", err);
        addLogToPane({ type: 'error', msg: `Network or Server Error: ${err.message}` });
        hasCompilationError = true;
        updateExportButtons();
        refs.page.innerHTML = `
            <div class="p-8 text-red-600 font-mono text-sm bg-red-50 h-full overflow-auto">
                <div class="flex items-center gap-2 font-bold mb-4">
                    <span class="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] uppercase">Compilation Error</span>
                </div>
                <div class="bg-white border border-red-200 rounded-lg p-4 shadow-sm">
                    <pre class="whitespace-pre-wrap leading-relaxed">${err.message}</pre>
                </div>
            </div>
        `;
    }
}

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

async function autoSave() {
    if (!currentProjectId) return;
    syncFileTreeWithEditor();
    try {
        await fetch('api/projects/save', {
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

    if (onPathChangeCallback) {
        onPathChangeCallback(path);
    }

    let content = node.content ?? node.data ?? "";

    if (content.startsWith('data:')) {
        try {
            const base64 = content.split(',')[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            content = new TextDecoder().decode(bytes);
            node.content = content;
        } catch (e) {
            console.error("Erreur décodage fichier secondaire:", e);
        }
    }

    refs.editor.setValue(content);
    refs.imageExplorer.style.display = "none";

    setTimeout(() => {
        isLoadingFile = false;
    }, 150);
}

export function setOnPathChange(cb) {
    onPathChangeCallback = cb;
}

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
        node.content = content;
        if (node.name.endsWith(".typ") || node.name.endsWith(".txt")) {
            node.data = content;
        } else {
            const bytes = new TextEncoder().encode(content);
            const binary = String.fromCharCode(...bytes);
            node.data = "data:text/plain;base64," + btoa(binary);
        }
    }
}

function getEditorLanguage(extension) {
    if (!extension) return "plaintext";
    const ext = extension.toLowerCase();
    switch (ext) {
        case "typ": return "typst";
        case "json": return "json";
        case "yml": case "yaml": return "yaml";
        case "py": return "python";
        case "js": case "mjs": case "cjs": return "javascript";
        case "ts": return "typescript";
        case "html": case "htm": return "html";
        case "css": return "css";
        case "md": case "markdown": return "markdown";
        case "sh": case "bash": return "shell";
        case "sql": return "sql";
        case "cpp": case "cc": case "cxx": return "cpp";
        case "c": return "c";
        case "rs": return "rust";
        case "go": return "go";
        case "scala": return "scala";
        default: return "plaintext";
    }
}