import { useEffect, useState } from 'react';
import { refs, infos, functions } from './refs';
import { addLogToPane, debounce, makeToast } from './useUtils';
import { fetchSvg, exportPdf, exportSvg, findMainFile } from './useApi';

export let currentProjectId;
export let fileTree = { type: 'folder', name: 'root', children: {} };
export let currentFolderPath = 'root';
export let currentFilePath = 'root/main.typ';
export let isLoadingFile = false;

let hasCompilationError = false;
let onPathChangeCallback = null;

export let canEdit = true;

let syncMarkers = [];

const BANNED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'pdf', 'ttf', 'otf', 'zip', 'svg'];
const ALWAYS_ALLOWED = ['typ', 'json', 'txt', 'md', 'js', 'css', 'py', 'sh', 'scala'];

let handleExportPdf = null;
let handleExportSvg = null;

const debounceFetchCompile = debounce(async () => {
  if (isLoadingFile) return;
  syncFileTreeWithEditor();
  await fetchCompile();
  if (canEdit) {
    await autoSave();
  }
});

export function setIsLoadingFile(value) {
  isLoadingFile = value;
}

export function setCanEdit(value) {
  canEdit = value;
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
  if (
    !refs.editor ||
    !refs.btnBold ||
    !refs.btnItalic ||
    !refs.btnUnderline ||
    !refs.page ||
    !refs.btnSave ||
    !refs.btnOpen ||
    !refs.fileInputOpen ||
    !refs.btnExportPdf ||
    !refs.btnExportSvg ||
    !refs.separator
  ) {
    return;
  }

  refs.editor.onDidChangeModelContent(() => {
    debounceFetchCompile();
  });

  refs.btnBold.addEventListener('click', () => {
    if (!canEdit) return;
    applyFormatting('bold');
  });
  refs.btnItalic.addEventListener('click', () => {
    if (!canEdit) return;
    applyFormatting('italic');
  });
  refs.btnUnderline.addEventListener('click', () => {
    if (!canEdit) return;
    applyFormatting('underline');
  });

  refs.btnSave.addEventListener('click', downloadDocument);

  refs.btnOpen.addEventListener('click', () => {
    if (!canEdit) return;
    refs.fileInputOpen.click();
  });
  refs.fileInputOpen.addEventListener('change', (e) => {
    if (!canEdit) return;
    openAndShowFile(e);
  });

  if (!handleExportPdf) {
    handleExportPdf = () => {
      if (hasCompilationError) {
        makeToast('Cannot export: compilation has errors', 'error');
        return;
      }
      exportPdf(fileTree);
    };
  }

  if (!handleExportSvg) {
    handleExportSvg = async () => {
      if (hasCompilationError) {
        makeToast('Cannot export: compilation has errors', 'error');
        return;
      }
      exportSvg(JSON.parse(await fetchSvg({ children: fileTree.children })).svg);
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
    console.warn('No fileTree loaded → fallback empty project');
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

async function applyFormatting(type) {
  const delimiters = {
    bold: ['*', '*'],
    italic: ['_', '_'],
    underline: ['#underline[', ']'],
  }[type];

  if (!delimiters || !refs.editor) return;

  const selection = refs.editor.getSelection();
  const model = refs.editor.getModel();
  const selectedText = model.getValueInRange(selection);

  if (selectedText === '') return;

  const newText = `${delimiters[0]}${selectedText}${delimiters[1]}`;

  refs.editor.executeEdits('format', [
    {
      range: selection,
      text: newText,
      forceMoveMarkers: true,
    },
  ]);

  await fetchCompile();
  await autoSave();
}

/**
 * Snapshot of the preview scroll container, taken right before #page is
 * collapsed to the loading spinner (which would otherwise clamp scrollTop
 * back to 0 and make the preview jump on every recompile).
 */
function captureScrollState() {
  const container = refs.previewContainer;
  if (!container) return null;
  return {
    scrollTop: container.scrollTop,
    scrollHeight: container.scrollHeight,
  };
}

/**
 * Returns true only when the file currently open in the editor is the
 * document's main/entry file. Sync markers are line numbers within the
 * main file's source, so trying to use them while editing an #include-d
 * file would point at the wrong content entirely.
 */
function isEditingMainFile() {
  const mainPath = findMainFile(fileTree) || 'main.typ';
  const normalizedCurrent = currentFilePath.replace(/^root\//, '');
  const normalizedMain = mainPath.replace(/^root\//, '');
  return normalizedCurrent === normalizedMain;
}

/**
 * Picks the sync marker closest to (at or before) the cursor's line, since
 * that's the most recently-rendered content above/at the edit point.
 * Falls back to the first marker in the document if the cursor is above
 * every marker (e.g. editing inside the very first paragraph).
 */
function findNearestSyncMarker(cursorLine) {
  if (!syncMarkers || syncMarkers.length === 0) return null;

  let best = null;
  for (const marker of syncMarkers) {
    if (marker.line <= cursorLine && (!best || marker.line > best.line)) {
      best = marker;
    }
  }
  return best || syncMarkers[0];
}

/**
 * Converts a marker's (page, x, y) in pt into real screen coordinates using
 * the rendered SVG's own page group transform (via getScreenCTM), then
 * scrolls the preview container so that point sits near the top of the
 * viewport (with a small margin), rather than centered. This works
 * regardless of zoom level or page layout since it lets the browser's own
 * SVG coordinate math do the conversion instead of us reimplementing it.
 * @returns {boolean} True if the scroll was applied.
 */
function scrollToSyncMarker(marker) {
  const TOP_MARGIN = 32;

  const container = refs.previewContainer;
  const svg = refs.page?.querySelector('svg');
  if (!container || !svg || !marker) return false;

  const pageGroups = svg.querySelectorAll('g.typst-page');
  const pageGroup = pageGroups[marker.page - 1];
  if (!pageGroup || typeof pageGroup.getScreenCTM !== 'function') return false;

  const ctm = pageGroup.getScreenCTM();
  if (!ctm) return false;

  const point = svg.createSVGPoint();
  point.x = marker.x;
  point.y = marker.y;
  const screenPoint = point.matrixTransform(ctm);

  const containerRect = container.getBoundingClientRect();
  const offset = screenPoint.y - containerRect.top - TOP_MARGIN + container.scrollTop;
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
  container.scrollTop = Math.min(Math.max(offset, 0), maxScroll);
  return true;
}

/**
 * Attempts to scroll the preview to the marker matching the current cursor
 * position. Returns false (does nothing) when sync isn't applicable, so the
 * caller can fall back to plain scroll preservation.
 */
function trySyncScrollToCursor() {
  if (!refs.editor || isLoadingFile || !isEditingMainFile()) return false;

  const position = refs.editor.getPosition();
  if (!position) return false;

  const marker = findNearestSyncMarker(position.lineNumber - 1);
  if (!marker) return false;

  return scrollToSyncMarker(marker);
}

/**
 * Sets #page's HTML then scrolls the preview to match the edit location
 * using the resolved sync markers. Falls back to preserving the previous
 * relative scroll position when sync isn't applicable (no markers, editing
 * a non-main file, etc.), so a recompile never silently snaps to the top.
 */
function setPageContent(html, scrollState) {
  refs.page.innerHTML = html;

  applyPageGaps(refs.page.querySelector('svg')); // NEW

  const container = refs.previewContainer;
  if (!container) return;

  if (trySyncScrollToCursor()) return;

  if (scrollState && scrollState.scrollHeight > 0) {
    const newScrollHeight = container.scrollHeight;
    const maxScroll = Math.max(0, newScrollHeight - container.clientHeight);
    const targetTop = (scrollState.scrollTop / scrollState.scrollHeight) * newScrollHeight;
    container.scrollTop = Math.min(Math.max(targetTop, 0), maxScroll);
  }
}

export async function fetchCompile() {
  if (!refs.page) return;

  const scrollState = captureScrollState();

  refs.page.innerHTML = `
        <div class="flex items-center justify-center h-full w-full bg-gray-50/50">
            <div class="relative">
                <div class="w-10 h-10 border-4 border-slate-200 rounded-full"></div>
                <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
            </div>
        </div>
    `;

  try {
    const raw = await fetchSvg(fileTree, { sync: true, projectId: currentProjectId });

    if (!raw) {
      syncMarkers = [];
      setPageContent(
        `<div class="flex items-center justify-center h-full text-slate-400 text-sm italic">Empty project — start typing to preview.</div>`,
        scrollState,
      );
      return;
    }

    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      throw new Error(`Compilation API response is not valid JSON:\n${raw}`);
    }

    if (result.logs) {
      result.logs.forEach((log) => addLogToPane(log));
      const hasError = result.logs.some((log) => log.type === 'error');
      hasCompilationError = hasError;
      updateExportButtons();
      if (hasError) {
        window.dispatchEvent(new CustomEvent('open-log-pane'));
      }
    }

    if (result.success && result.svg) {
      hasCompilationError = false;
      updateExportButtons();
      syncMarkers = Array.isArray(result.syncMarkers) ? result.syncMarkers : [];
      setPageContent(result.svg, scrollState);
    } else {
      let errorMessage = 'Unknown compilation error';
      if (result.logs) {
        const errorLog = result.logs.find((l) => l.type === 'error');
        if (errorLog) errorMessage = errorLog.msg;
      }

      hasCompilationError = true;
      updateExportButtons();
      syncMarkers = [];

      setPageContent(
        `
                <div class="p-8 text-red-600 font-mono text-sm bg-red-50 h-full overflow-auto">
                    <div class="flex items-center gap-2 font-bold mb-4">
                        <span class="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] uppercase">Compilation Failed</span>
                    </div>
                    <div class="bg-white border border-red-200 rounded-lg p-4 shadow-sm">
                        <pre class="whitespace-pre-wrap leading-relaxed">${errorMessage}</pre>
                    </div>
                    <p class="mt-4 text-red-400 text-xs italic">Check the System Logs for more details.</p>
                </div>
            `,
        scrollState,
      );
    }
  } catch (err) {
    console.error('Critical Fetch Error:', err);
    addLogToPane({ type: 'error', msg: `Network or Server Error: ${err.message}` });
    hasCompilationError = true;
    updateExportButtons();
    syncMarkers = [];
    setPageContent(
      `
            <div class="p-8 text-red-600 font-mono text-sm bg-red-50 h-full overflow-auto">
                <div class="flex items-center gap-2 font-bold mb-4">
                    <span class="px-2 py-0.5 bg-red-600 text-white rounded text-[10px] uppercase">Compilation Error</span>
                </div>
                <div class="bg-white border border-red-200 rounded-lg p-4 shadow-sm">
                    <pre class="whitespace-pre-wrap leading-relaxed">${err.message}</pre>
                </div>
            </div>
        `,
      scrollState,
    );
  }
}

export function downloadDocument() {
  const content = refs.editor.getValue();
  if (!content) return;

  const blob = new Blob([content], { type: 'text/plain' });
  const filename = `${new Date().toISOString().replace(/[-:.]/g, '')}_typstDocument.typ`;
  const link = document.createElement('a');
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
  await persistFileTree(fileTree);
}

let isDragging = false;
let container;

function setupResizable() {
  if (!refs.separator) return;
  container = refs.separator.parentElement;

  refs.separator.addEventListener('mousedown', () => {
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

  const parts = path.replace('root/', '').split('/');
  let node = fileTree;
  for (const part of parts) {
    if (node && node.children) node = node.children[part];
  }

  if (!node || node.type === 'folder') return;

  const ext = node.name.split('.').pop().toLowerCase();

  if (BANNED_EXTENSIONS.includes(ext)) {
    makeToast(`Interrupted: .${ext} is a binary file.`, 'error');
    return;
  }

  if (!ALWAYS_ALLOWED.includes(ext)) {
    const confirmForce = window.confirm(
      `Unknown extension .${ext}. \n\nOpening this as text might corrupt the file if it's not a plain text format. Do you want to proceed?`,
    );
    if (!confirmForce) return;
  }

  const lang = getEditorLanguage(ext);
  const model = refs.editor.getModel();
  if (model) {
    refs.monaco.editor.setModelLanguage(model, lang);
  }

  isLoadingFile = true;
  currentFilePath = path;

  if (onPathChangeCallback) {
    onPathChangeCallback(path);
  }

  let content = node.content ?? node.data ?? '';

  if (content.startsWith('data:')) {
    try {
      const base64 = content.split(',')[1];
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      content = new TextDecoder().decode(bytes);
      node.content = content;
    } catch (e) {
      console.error('Erreur décodage fichier secondaire:', e);
    }
  }

  refs.editor.setValue(content);
  functions.closeFileExplorer()

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
  const parts = currentFilePath.replace('root/', '').split('/');
  let node = fileTree;

  for (const part of parts) {
    if (node && node.children && node.children[part]) {
      node = node.children[part];
    } else {
      return;
    }
  }

  if (node && node.type === 'file') {
    node.content = content;
    if (node.name.endsWith('.typ') || node.name.endsWith('.txt')) {
      node.data = content;
    } else {
      const bytes = new TextEncoder().encode(content);
      const binary = String.fromCharCode(...bytes);
      node.data = 'data:text/plain;base64,' + btoa(binary);
    }
  }
}

function getEditorLanguage(extension) {
  if (!extension) return 'plaintext';
  const ext = extension.toLowerCase();
  switch (ext) {
    case 'typ':
      return 'typst';
    case 'json':
      return 'json';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'py':
      return 'python';
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'sql':
      return 'sql';
    case 'cpp':
    case 'cc':
    case 'cxx':
      return 'cpp';
    case 'c':
      return 'c';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'scala':
      return 'scala';
    default:
      return 'plaintext';
  }
}

let isQuotaExceeded = false;

/**
 * Sauvegarde le fileTree sur le serveur, gère les erreurs de quota
 * sans spammer l'utilisateur à chaque frappe.
 * @param {Object} tree - Le fileTree à sauvegarder
 * @returns {Promise<boolean>} true si sauvegardé avec succès
 */
export async function persistFileTree(tree) {
  if (!currentProjectId) return false;

  try {
    const res = await fetch('/api/projects/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: currentProjectId, fileTree: tree }),
    });

    if (!res.ok) {
      const message = await res.text();

      if (res.status === 403) {
        if (!isQuotaExceeded) {
          isQuotaExceeded = true;
          makeToast(message || 'Storage quota exceeded — changes are not being saved.', 'error');
          window.dispatchEvent(new CustomEvent('quota-exceeded', { detail: { message } }));
        }
      } else {
        makeToast('Failed to save project.', 'error');
      }
      return false;
    }

    if (isQuotaExceeded) {
      isQuotaExceeded = false;
      makeToast('Storage OK — saving resumed.', 'success');
    }

    return true;
  } catch (err) {
    console.error('Erreur sauvegarde:', err);
    makeToast('Network error — could not save project.', 'error');
    return false;
  }
}

/** Gap between rendered pages, in the SVG's own coordinate units. */
const PAGE_GAP = 24;

/**
 * Visually separates rendered Typst pages by inserting a vertical gap
 * between each page group and giving each one its own white "sheet"
 * rectangle, instead of one continuous slab of white.
 */
function applyPageGaps(svg) {
  if (!svg) return;

  svg.style.background = 'transparent';

  const pages = svg.querySelectorAll('g.typst-page');
  if (pages.length === 0) return;

  let cursorY = 0;
  let maxWidth = 0;

  pages.forEach((page) => {
    const pageWidth = parseFloat(page.getAttribute('data-page-width')) || 0;
    const pageHeight = parseFloat(page.getAttribute('data-page-height')) || 0;

    page.setAttribute('transform', `translate(0, ${cursorY})`);

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '0');
    bg.setAttribute('y', '0');
    bg.setAttribute('width', String(pageWidth));
    bg.setAttribute('height', String(pageHeight));
    bg.setAttribute('fill', 'white');
    bg.setAttribute('stroke', '#e2e8f0');
    bg.setAttribute('stroke-width', '1');
    page.insertBefore(bg, page.firstChild);

    cursorY += pageHeight + PAGE_GAP;
    maxWidth = Math.max(maxWidth, pageWidth);
  });

  const totalHeight = Math.max(0, cursorY - PAGE_GAP);
  svg.setAttribute('viewBox', `0 0 ${maxWidth} ${totalHeight}`);
  svg.setAttribute('width', String(maxWidth));
  svg.setAttribute('height', String(totalHeight));
  svg.setAttribute('data-width', String(maxWidth));
  svg.setAttribute('data-height', String(totalHeight));
}
