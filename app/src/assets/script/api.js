import { downloadBlob, formatDateNow } from './utils.js';

const API_URL = "http://127.0.0.1:3001";

// Collect images from file tree recursively
function collectImages(folder) {
    let result = {};
    const children = folder && folder.children ? folder.children : {};
    Object.values(children).forEach(item => {
        if (item.type === "file") {
            if (item.fullPath.includes("root")) {
                item.fullPath = item.fullPath.replace("root/", "");
            }
            result[item.fullPath] = item.data;
        }
        else if (item.type === "folder") {
            Object.assign(result, collectImages(item));
        } 
    });
    return result;
}

// Send source + images to server and get SVG
export async function fetchSvg(source, fileTree) {
    if (!source && Object.keys(fileTree.children).length === 0) return "";
    try {
        const response = await fetch(`${API_URL}/render`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source, images: collectImages(fileTree) })
        });
        return await response.text();
    } catch (e) {
        console.error("SVG fetch error:", e);
        return "";
    }
}

// Export PDF
export async function exportPdf(source, fileTree) {
    if (!source) return;

    const payload = { source, images: collectImages(fileTree) };
    try {
        const response = await fetch(`${API_URL}/export/pdf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const blob = await response.blob();
        const filename = `${formatDateNow()}_typstDocument.pdf`;
        downloadBlob(blob, filename);

    } catch (e) {
        console.error("PDF export error:", e);
    }
}

// Export SVG
export function exportSvg(svgContent) {
    if (!svgContent) return;
    
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const filename = `${formatDateNow()}_typstDocument.svg`;
    downloadBlob(blob, filename);
}
