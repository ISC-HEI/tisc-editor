import { downloadBlob, formatDateNow } from "./useUtils";

export async function fetchSvg(fileTree) {
    if (!fileTree || !fileTree.children || Object.keys(fileTree.children).length === 0) return "";

    try {
        const response = await fetch("/api/projects/compile", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ 
                fileTree: fileTree,
                format: "svg" 
            })
        });

        if (!response.ok) {
            throw new Error(`Erreur compilation: ${response.statusText}`);
        }

        return await response.text();
    } catch (e) {
        console.error("SVG fetch error:", e);
        return "";
    }
}

// ----------------------------------------------------

export async function exportPdf(fileTree) {
    if (!fileTree || !fileTree.children) return;

    try {
        const response = await fetch("/api/projects/compile", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ 
                fileTree: fileTree,
                format: "pdf"
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

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
