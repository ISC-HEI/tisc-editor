import { fetchSvg, exportPdf, exportSvg } from './api.js';
import { debounce } from './utils.js';

export let fileTree = { type: "folder", name: "root", children: {} };
export let currentFolderPath = "root";

// ---------- Editor elements ----------
const textarea = document.getElementById('editor');
const lineNumbers = document.getElementById('lineNumbers');
const page = document.getElementById("page");

export const uploadedImages = {};

// ---------- Formatting functions ----------
export function applyFormatting(type) {
    const delimiters = {
        bold: ["*", "*"],
        italic: ["_", "_"],
        underline: ["#underline[", "]"]
    }[type];

    if (!delimiters) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return;

    const selectedText = textarea.value.substring(start, end);
    const newText = `${delimiters[0]}${selectedText}${delimiters[1]}`;

    textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
    textarea.selectionStart = start;
    textarea.selectionEnd = start + newText.length;
    textarea.focus();

    fetchCompile();
}

// ---------- Line numbers ----------
export function updateLineNumbers() {
    const lines = textarea.value.split('\n').length;
    lineNumbers.innerHTML = "";

    for (let i = 1; i <= lines; i++) {
        const span = document.createElement("span");
        span.innerText = i;
        lineNumbers.appendChild(span);
    }
}

textarea.addEventListener('scroll', () => {
    lineNumbers.scrollTop = textarea.scrollTop;
});

// ---------- Main compile function ----------
export async function fetchCompile() {
    const svg = await fetchSvg(textarea.value, { children: fileTree.children });
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
    const content = textarea.value;
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
export function initEditorListeners(btnBold, btnItalic, btnUnderline, btnSave, btnOpen, fileInput, btnExportPdf, btnExportSvg) {
    textarea.addEventListener('input', () => { updateLineNumbers(); debounceFetchCompile(); });
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;

            textarea.value = textarea.value.substring(0, start) + "\t" + textarea.value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + 1;
        }
    });

    btnBold.addEventListener('click', () => applyFormatting('bold'));
    btnItalic.addEventListener('click', () => applyFormatting('italic'));
    btnUnderline.addEventListener('click', () => applyFormatting('underline'));
    
    btnSave.addEventListener('click', downloadDocument);
    btnOpen.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', openAndShowFile);

    btnExportPdf.addEventListener('click', () => exportPdf(textarea.value, { children: fileTree.children }));
    btnExportSvg.addEventListener('click', async () => exportSvg(await fetchSvg(textarea.value, { children: fileTree.children })));
}

const debounceFetchCompile = debounce(fetchCompile);

// Open a local file
function openAndShowFile() {
    const file = fileInput.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => { textarea.value = e.target.result; updateLineNumbers(); fetchCompile(); };
    reader.readAsText(file);
}


// -------- Change pages size --------
const separator = document.getElementById('separator');
const left = document.getElementById("preview")

const container = left.parentElement;
const containerWidth = container.getBoundingClientRect().width;
let isDragging = false;
const previewMinWidth=250

separator.addEventListener('mousedown', () => {
    isDragging = true;
    document.body.style.cursor = 'col-resize';
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const containerLeft = left.parentElement.getBoundingClientRect().left;
    const newWidth = containerWidth - (e.clientX - containerLeft);

    if (newWidth < previewMinWidth) {
        newWidth=previewMinWidth
    }
    left.style.width = newWidth + 'px';
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.cursor = 'default';
});
