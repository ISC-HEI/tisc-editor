import { downloadBlob, formatDateNow } from "./useUtils";

const NEXT_PUBLIC_COMPILER_URL = process.env.NEXT_PUBLIC_COMPILER_URL

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

// ----------------------------------------------------

export async function fetchSvg(fileTree) {
    if (!fileTree || !fileTree.children || Object.keys(fileTree.children).length === 0) return "";
    try {
        const response = await fetch(`${NEXT_PUBLIC_COMPILER_URL}/render`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileTree: fileTree }) 
        });
        return await response.text();
    } catch (e) {
        console.error("SVG fetch error:", e);
        return "";
    }
}

// ----------------------------------------------------

export async function exportPdf(fileTree) {
    try {
        const response = await fetch(`${NEXT_PUBLIC_COMPILER_URL}/export/pdf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileTree: fileTree })
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const blob = await response.blob();
        downloadBlob(blob, `${formatDateNow()}_typstDocument.pdf`);
    } catch (e) {
        console.error("PDF export error:", e);
    }
}

export function exportSvg(svgContent) {
    if (!svgContent) return;
    
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const filename = `${formatDateNow()}_typstDocument.svg`;
    downloadBlob(blob, filename);
}
