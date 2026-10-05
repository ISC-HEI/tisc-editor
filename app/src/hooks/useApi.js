import { downloadBlob, formatDateNow } from './useUtils';

/**
 * Sends the project file tree to the server to compile it into an SVG string.
 * @param {Object} fileTree - The hierarchical structure of the project files.
 * @param {Object} [options] - Compile options.
 * @param {boolean} [options.sync=false] - When true, asks the backend to inject
 *   invisible position markers into the main file and return their resolved
 *   preview coordinates (syncMarkers), used to scroll the preview to match
 *   the editor cursor. Left false for exports so the exported SVG stays clean.
 * @returns {Promise<string>} The SVG content as a string, or an empty string if compilation fails.
 */
export async function fetchSvg(fileTree, { sync = false, projectId } = {}) {
  if (!fileTree || !fileTree.children || Object.keys(fileTree.children).length === 0) return '';

  const mainPath = findMainFile(fileTree) || findFirstFile(fileTree) || 'main.typ';

  const pathParts = mainPath.split('/');
  let current = fileTree;

  for (const part of pathParts) {
    if (current.children && current.children[part]) {
      current = current.children[part];
    }
  }

  if (current.type === 'file' && (!current.data || current.data.trim() === '')) {
    current.data = ' ';
  }

  try {
    const response = await fetch('/api/projects/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileTree: toCompileTree(fileTree),
        mainFile: mainPath,
        format: 'svg',
        sync,
        projectId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur compilation: ${errorText || response.statusText}`);
    }

    return await response.text();
  } catch (e) {
    console.error('SVG fetch error:', e);
    throw e;
  }
}

/**
 * Compiles the project and triggers a browser download for the resulting PDF file.
 * @param {Object} fileTree - The hierarchical structure of the project files.
 * @returns {Promise<void>}
 */
export async function exportPdf(fileTree) {
  if (!fileTree || !fileTree.children) return;

  const mainPath = findMainFile(fileTree) || findFirstFile(fileTree) || 'main.typ';

  const pathParts = mainPath.split('/');
  let current = fileTree;

  for (const part of pathParts) {
    if (current.children && current.children[part]) {
      current = current.children[part];
    }
  }

  if (current.type === 'file' && (!current.data || current.data.trim() === '')) {
    current.data = ' ';
  }

  try {
    const response = await fetch('/api/projects/compile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileTree: toCompileTree(fileTree),
        mainFile: mainPath,
        format: 'pdf',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    const blob = await response.blob();
    downloadBlob(blob, `${formatDateNow()}_typstDocument.pdf`);
  } catch (e) {
    console.error('PDF export error:', e);
  }
}

/**
 * Converts a raw SVG string into a Blob and triggers a browser download.
 * @param {string} svgContent - The raw SVG XML string to export.
 */
export function exportSvg(svgContent) {
  if (!svgContent) return;

  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const filename = `${formatDateNow()}_typstDocument.svg`;
  downloadBlob(blob, filename);
}

/**
 * Cherche récursivement le fichier principal (isMain: true) dans le fileTree.
 * @param {Object} node - Le nœud courant.
 * @returns {string|null} - Le fullPath du fichier principal ou null si absent.
 */
export const findMainFile = (node) => {
  if (!node) return null;
  if (node.type === 'file' && node.isMain) {
    return node.fullPath;
  }

  if (node.children) {
    for (const child of Object.values(node.children)) {
      const result = findMainFile(child);
      if (result) return result;
    }
  }

  return null;
};

const findFirstFile = (node) => {
  if (!node) return null;
  if (node.type === 'file') {
    return node.fullPath;
  }

  if (node.children) {
    for (const child of Object.values(node.children)) {
      const result = findFirstFile(child);
      if (result) return result;
    }
  }

  return null;
};

function decodeDataUrl(str) {
  if (typeof str !== 'string' || !str.startsWith('data:')) return str;
  try {
    const binary = atob(str.split(',')[1]);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return str;
  }
}

function toCompileTree(node) {
  if (!node) return node;

  if (node.type === 'file') {
    const isPlainTextFile = node.name.endsWith('.typ') || node.name.endsWith('.txt');
    if (!isPlainTextFile) return node;

    const text = node.content ?? decodeDataUrl(node.data) ?? '';
    return { ...node, data: text };
  }

  if (node.children) {
    return {
      ...node,
      children: Object.fromEntries(
        Object.entries(node.children).map(([k, child]) => [k, toCompileTree(child)]),
      ),
    };
  }
  return node;
}
