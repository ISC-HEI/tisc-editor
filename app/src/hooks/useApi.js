import { downloadBlob, formatDateNow } from "./useUtils";

/**
 * Sends the project file tree to the server to compile it into an SVG string.
 * * @param {Object} fileTree - The hierarchical structure of the project files.
 * @returns {Promise<string>} The SVG content as a string, or an empty string if compilation fails.
 */
export async function fetchSvg(fileTree) {
    if (!fileTree || !fileTree.children || Object.keys(fileTree.children).length === 0) return "";

    try {
        const response = await fetch("api/projects/compile", {
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

/**
 * Compiles the project and triggers a browser download for the resulting PDF file.
 * * @param {Object} fileTree - The hierarchical structure of the project files.
 * @returns {Promise<void>}
 */
export async function exportPdf(fileTree) {
    if (!fileTree || !fileTree.children) return;

    try {
        const response = await fetch("api/projects/compile", {
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

/**
 * Converts a raw SVG string into a Blob and triggers a browser download.
 * * @param {string} svgContent - The raw SVG XML string to export.
 */
export function exportSvg(svgContent) {
    if (!svgContent) return;

    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const filename = `${formatDateNow()}_typstDocument.svg`;
    downloadBlob(blob, filename);
}
