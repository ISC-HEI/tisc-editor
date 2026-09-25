import { useEffect, useState } from 'react';
import {
  createElement,
  FileJson,
  Book,
  FileCode,
  Image,
  FileQuestion,
  Folder,
  FolderOpen,
  Terminal,
  Notebook,
  ChevronRight,
} from 'lucide';
import { refs, functions, infos } from '@/hooks/refs';
import {
  currentProjectId,
  fetchCompile,
  fileTree,
  openFile,
  syncFileTreeWithEditor,
  persistFileTree,
} from './useEditor';
import { makeToast } from './useUtils';
import JSZip from 'jszip';
import { canEdit } from './useEditor';
import { getExtensionConfig } from '@/config/fileExtensions';

/** @type {string} Path of the folder currently selected for operations like file creation or upload. */
let selectedFolderPath = 'root';

/**
 * @type {string|null} Path of the item that is both the keyboard-navigation cursor and the
 * context-menu/rename target ("selection", in the VS Code sense). Distinct from the file
 * currently open in the editor — see `activeFilePath`.
 */
let lastClickedPath = null;

/** @type {string|null} Path of the file currently open in the editor, used for the "active" row highlight. */
let activeFilePath = null;

/** @type {Set<string>} Folder paths that are currently expanded in the tree. */
let expandedPaths = new Set();

/** @type {boolean} Guards the one-time auto-expansion towards the main file on first load. */
let initialExpansionDone = false;

/**
 * @type {string|null} Path of the item currently being renamed inline. While set, the tree
 * renders a text input in place of that item's name instead of the static label.
 */
let renamingPath = null;

/**
 * Adds a new node (file or folder) to the local file tree structure.
 * @param {Object} root - The root object of the file tree.
 * @param {string} path - The full destination path starting with "root/".
 * @param {'file'|'folder'} type - The type of the node.
 * @param {string} [data=""] - The content or Base64 data if it's a file.
 */
export const addNodeToLocalTree = (root, path, type, data = '') => {
  const cleanPath = path.replace(/^root\//, '');
  const parts = cleanPath.split('/').filter((x) => x);
  const fileName = parts.pop();
  let current = root;

  for (const part of parts) {
    if (!current.children[part]) {
      current.children[part] = { name: part, type: 'folder', children: {} };
    }
    current = current.children[part];
  }

  current.children[fileName] = {
    name: fileName,
    type: type,
    fullPath: path.replace(/^root\//, ''),
    data: type === 'file' ? data : null,
    children: type === 'folder' ? {} : null,
  };
};

/**
 * Removes a node from the local tree based on its path.
 * @param {Object} root - The root object of the file tree.
 * @param {string} path - The full path of the item to delete.
 */
export const deleteNodeFromLocalTree = (root, path) => {
  const cleanPath = path.replace(/^root\//, '');
  const parts = cleanPath.split('/').filter((x) => x);
  const fileName = parts.pop();
  let current = root;

  for (const part of parts) {
    if (current && current.children) {
      current = current.children[part];
    }
  }

  if (current && current.children) {
    delete current.children[fileName];
  }
};

/**
 * Renames or moves a node by copying its data, deleting the old entry,
 * and creating a new one at the target path.
 * @param {Object} root - The root object of the file tree.
 * @param {string} oldPath - Current path of the node.
 * @param {string} newPath - New target path for the node.
 */
export const renameNodeInLocalTree = (root, oldPath, newPath) => {
  const findNode = (p) => {
    const cleanP = p.replace(/^root\//, '');
    const parts = cleanP.split('/').filter((x) => x);
    let curr = root;
    for (const part of parts) {
      if (curr && curr.children) curr = curr.children[part];
    }
    return curr;
  };

  const nodeToMove = findNode(oldPath);
  if (nodeToMove) {
    const dataCopy = JSON.parse(JSON.stringify(nodeToMove));
    deleteNodeFromLocalTree(root, oldPath);
    addNodeToLocalTree(root, newPath, dataCopy.type, dataCopy.data);
    const newNode = findNode(newPath);
    if (dataCopy.type === 'folder') newNode.children = dataCopy.children;
  }
};

// ----------------------------------------------------
// Selection / active-file / expansion state helpers
// ----------------------------------------------------

/**
 * Selects a tree row (keyboard cursor + context-menu/rename target) and syncs the
 * corresponding classes/aria/tabIndex directly on the live DOM, without a full re-render.
 * Passing `null` clears the selection (used when clicking the root drop zone).
 * @param {string|null} path
 */
function applySelection(path) {
  lastClickedPath = path;
  const items = Array.from(refs.imageList?.querySelectorAll('[role="treeitem"]') ?? []);

  items.forEach((el) => {
    const match = el.dataset.path === path;
    el.classList.toggle('selected-item', match);
    el.setAttribute('aria-selected', String(match));
    el.tabIndex = match ? 0 : -1;
  });

  // A roving-tabindex tree always needs exactly one focusable item.
  if (items.length > 0 && !items.some((el) => el.tabIndex === 0)) {
    items[0].tabIndex = 0;
  }
}

/**
 * Marks a file as the one currently open in the editor and updates the "active" highlight
 * directly on the live DOM (cheap — doesn't require rebuilding the tree).
 * @param {string} path
 */
function applyActiveFile(path) {
  activeFilePath = path;
  const items = refs.imageList?.querySelectorAll('[role="treeitem"][data-type="file"]') ?? [];

  items.forEach((el) => {
    const match = el.dataset.path === path;
    el.classList.toggle('active-item', match);
    el.querySelector('.tree-item-row')?.classList.toggle('bg-indigo-50', match);
  });
}

/**
 * Opens a file and keeps the "active file" highlight in sync, without a full tree re-render.
 * @param {string} path
 */
async function openFileAndTrack(path) {
  applyActiveFile(path);
  await openFile(path);
}

/**
 * Expands every ancestor folder of a given path, so the item becomes visible in the tree.
 * @param {string} itemPath - Path of the file or folder to reveal.
 */
function expandAncestors(itemPath) {
  const parts = itemPath.split('/').filter(Boolean);
  parts.pop();
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    expandedPaths.add(acc);
  }
}

/**
 * Toggles a folder's expanded state and re-renders the tree.
 * @param {string} path
 * @param {boolean} expand
 */
function toggleExpand(path, expand) {
  if (expand) expandedPaths.add(path);
  else expandedPaths.delete(path);
  lastClickedPath = path;
  renderFileExplorer(fileTree);
}

/**
 * Walks the tree once to find the main file and expands its ancestor folders,
 * so the entry point is visible the first time the explorer is opened.
 * @param {Object} folder
 * @param {string} [path='']
 * @returns {boolean} Whether the main file was found (stops the search once true).
 */
function computeInitialExpansion(folder, path = '') {
  for (const item of Object.values(folder.children)) {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    if (item.type === 'file' && item.isMain) {
      expandAncestors(fullPath);
      return true;
    }
    if (item.type === 'folder' && computeInitialExpansion(item, fullPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Rewrites any tracked path (selection, active file, expanded folders) that pointed at
 * `oldPath` or one of its descendants, so state stays valid after a rename or move.
 * @param {string} oldPath
 * @param {string} newPath
 */
function migratePathState(oldPath, newPath) {
  const rewrite = (p) => {
    if (!p) return p;
    if (p === oldPath) return newPath;
    if (p.startsWith(`${oldPath}/`)) return newPath + p.slice(oldPath.length);
    return p;
  };

  const kept = new Set();
  expandedPaths.forEach((p) => kept.add(rewrite(p)));
  expandedPaths = kept;

  lastClickedPath = rewrite(lastClickedPath);
  activeFilePath = rewrite(activeFilePath);
  renamingPath = rewrite(renamingPath);
  if (selectedFolderPath !== 'root') selectedFolderPath = rewrite(selectedFolderPath);
}

/**
 * Clears any tracked path (selection, active file, expanded folders) that pointed at
 * `deletedPath` or one of its descendants, so state doesn't reference a node that no longer exists.
 * @param {string} deletedPath
 */
function clearPathState(deletedPath) {
  if (lastClickedPath === deletedPath || lastClickedPath?.startsWith(`${deletedPath}/`)) {
    lastClickedPath = null;
  }
  if (activeFilePath === deletedPath || activeFilePath?.startsWith(`${deletedPath}/`)) {
    activeFilePath = null;
  }
  if (renamingPath === deletedPath || renamingPath?.startsWith(`${deletedPath}/`)) {
    renamingPath = null;
  }
  if (selectedFolderPath === deletedPath || selectedFolderPath?.startsWith(`${deletedPath}/`)) {
    selectedFolderPath = 'root';
  }

  const kept = new Set();
  expandedPaths.forEach((p) => {
    if (p !== deletedPath && !p.startsWith(`${deletedPath}/`)) kept.add(p);
  });
  expandedPaths = kept;
}

/**
 * Returns the ancestor treeitem `<li>` of a given row, if any.
 * @param {HTMLElement} el
 */
function getParentTreeitem(el) {
  return el.parentElement?.closest('[role="treeitem"]') ?? null;
}

// ----------------------------------------------------
// Keyboard navigation (ARIA treeview pattern)
// ----------------------------------------------------

/**
 * Delegated keydown handler for the tree, implementing the standard ARIA treeview
 * keyboard interactions: arrow keys to navigate, Enter/Space to open or toggle,
 * Delete/Backspace to remove (with confirmation), Home/End to jump to the ends.
 * @param {KeyboardEvent} e
 */
function handleTreeKeyDown(e) {
  const items = Array.from(refs.imageList?.querySelectorAll('[role="treeitem"]') ?? []);
  if (items.length === 0) return;

  const currentEl = e.target.closest?.('[role="treeitem"]');
  const currentIndex = currentEl ? items.indexOf(currentEl) : -1;

  switch (e.key) {
    case 'ArrowDown': {
      e.preventDefault();
      (items[currentIndex + 1] || items[items.length - 1] || items[0])?.focus();
      break;
    }
    case 'ArrowUp': {
      e.preventDefault();
      (items[currentIndex - 1] || items[0])?.focus();
      break;
    }
    case 'Home': {
      e.preventDefault();
      items[0]?.focus();
      break;
    }
    case 'End': {
      e.preventDefault();
      items[items.length - 1]?.focus();
      break;
    }
    case 'ArrowRight': {
      if (!currentEl) break;
      e.preventDefault();
      const path = currentEl.dataset.path;
      if (currentEl.dataset.type === 'folder') {
        if (!expandedPaths.has(path)) {
          toggleExpand(path, true);
        } else {
          const group = currentEl.querySelector(':scope > [role="group"]');
          group?.querySelector(':scope > [role="treeitem"]')?.focus();
        }
      }
      break;
    }
    case 'ArrowLeft': {
      if (!currentEl) break;
      e.preventDefault();
      const path = currentEl.dataset.path;
      if (currentEl.dataset.type === 'folder' && expandedPaths.has(path)) {
        toggleExpand(path, false);
      } else {
        getParentTreeitem(currentEl)?.focus();
      }
      break;
    }
    case 'Enter':
    case ' ': {
      if (!currentEl) break;
      e.preventDefault();
      const path = currentEl.dataset.path;
      if (currentEl.dataset.type === 'folder') {
        selectedFolderPath = path;
        toggleExpand(path, !expandedPaths.has(path));
      } else {
        applySelection(path);
        openFileAndTrack(path);
      }
      break;
    }
    case 'Delete':
    case 'Backspace': {
      if (!currentEl || !canEdit) break;
      e.preventDefault();
      deleteItem(currentEl.dataset.path, fileTree);
      break;
    }
    default:
      break;
  }
}

/**
 * Initializes listeners for file management UI components (Upload, Create, Drag & Drop).
 * Checks if all required DOM references are available before binding events.
 * @returns {boolean} True if listeners were successfully attached.
 */
function initFileManager() {
  if (
    !refs.imageList ||
    !refs.btnShowImages ||
    !refs.imageExplorer ||
    !refs.btnCloseImages ||
    !functions.openCustomPrompt ||
    !functions.openCustomConfirm ||
    !refs.btnUploadImages ||
    !refs.imageFilesInput ||
    !refs.rootDropZone ||
    !refs.btnCreateFile ||
    !refs.btnExportZip
  ) {
    return false;
  }

  // Accessibility: turn the list into a proper ARIA treeview and wire up keyboard navigation once.
  refs.imageList.setAttribute('role', 'tree');
  refs.imageList.setAttribute('aria-label', 'Project files');
  refs.imageList.addEventListener('keydown', handleTreeKeyDown);

  refs.btnShowImages.addEventListener('click', () => {
    refs.imageExplorer.style.display = 'block';
  });

  refs.btnCloseImages.addEventListener('click', () => {
    if (functions.closeFileExplorer) {
      functions.closeFileExplorer();
    } else {
      refs.imageExplorer.style.display = 'none';
    }
  });

  refs.btnCreateFolder.addEventListener('click', () => {
    if (!canEdit) return;
    functions.openCustomPrompt(`Create new folder in ${selectedFolderPath}`, async (folderName) => {
      if (!folderName) return;

      const targetFolder = getFolder(fileTree, selectedFolderPath);
      if (targetFolder) {
        if (!targetFolder.children[folderName]) {
          targetFolder.children[folderName] = {
            type: 'folder',
            name: folderName,
            children: {},
          };

          const newFolderPath =
            selectedFolderPath === 'root' ? folderName : `${selectedFolderPath}/${folderName}`;
          lastClickedPath = newFolderPath;

          renderFileExplorer(fileTree);
          await saveFileTree();

          if (refs.socket?.connected) {
            const socketPath =
              selectedFolderPath === 'root'
                ? `root/${folderName}`
                : `root/${selectedFolderPath}/${folderName}`;
            refs.socket.emit('create-node', {
              docId: currentProjectId,
              path: socketPath,
              type: 'folder',
            });
          }

          selectedFolderPath = 'root';
        }
      }
    });
  });

  refs.btnUploadImages.addEventListener('click', (e) => {
    if (!canEdit) return;
    e.preventDefault();
    refs.imageFilesInput.click();
  });

  refs.imageFilesInput.addEventListener('change', (event) => {
    if (!canEdit) return;
    const files = Array.from(event.target.files);
    const targetFolder = getFolder(fileTree, selectedFolderPath);

    if (!targetFolder) {
      alert('Invalid target folder');
      return;
    }

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        targetFolder.children[file.name] = {
          type: 'file',
          name: file.name,
          fullPath:
            selectedFolderPath === 'root' ? file.name : `${selectedFolderPath}/${file.name}`,
          data: e.target.result,
        };
        await saveFileTree();
        renderFileExplorer(fileTree);
        fetchCompile();

        if (refs.socket?.connected) {
          const socketPath =
            selectedFolderPath === 'root'
              ? `root/${file.name}`
              : `root/${selectedFolderPath}/${file.name}`;
          refs.socket.emit('create-node', {
            docId: currentProjectId,
            path: socketPath,
            type: 'file',
          });
        }
      };
      reader.readAsDataURL(file);
    });
  });

  refs.rootDropZone.addEventListener('click', () => {
    applySelection(null);
    selectedFolderPath = 'root';
  });

  refs.rootDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    refs.rootDropZone.classList.add('bg-indigo-50', 'border-indigo-300');
  });

  refs.rootDropZone.addEventListener('dragleave', () => {
    refs.rootDropZone.classList.remove('bg-indigo-50', 'border-indigo-300');
  });

  refs.rootDropZone.addEventListener('drop', (e) => {
    if (!canEdit) return;
    e.preventDefault();
    refs.rootDropZone.classList.remove('bg-indigo-50', 'border-indigo-300');

    const sourcePath = e.dataTransfer.getData('path');
    if (sourcePath) moveItem(sourcePath, 'root', fileTree);
  });

  refs.btnCreateFile.addEventListener('click', () => {
    if (!canEdit) return;
    createFile();
  });

  refs.btnExportZip.addEventListener('click', () => {
    exportZip(fileTree, infos.title || 'unknow_project');
  });

  if (!initialExpansionDone) {
    computeInitialExpansion(fileTree);
    initialExpansionDone = true;
  }

  renderFileExplorer(fileTree);

  return true;
}

/**
 * React hook that ensures the File Manager is initialized and sets up
 * global keyboard shortcuts (e.g., F2 for renaming).
 */
export function useFileManagerWatcher() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const success = initFileManager();

    if (!success && !initialized) {
      const interval = setInterval(() => {
        if (initFileManager()) {
          setInitialized(true);
          clearInterval(interval);
        }
      }, 100);
    }

    const handleGlobalKeyDown = (e) => {
      if (e.key === 'F2' && canEdit) {
        const pathToRename =
          lastClickedPath || (typeof currentFilePath !== 'undefined' ? currentFilePath : null);

        if (pathToRename) {
          e.preventDefault();
          renameItem(pathToRename);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [initialized]);
}

// ----------------------------------------------------

/**
 * Recursively traverses the tree to find a folder node at a specific path.
 * @param {Object} fileTree - The root tree to search in.
 * @param {string} path - The relative path from root.
 * @returns {Object|null} The folder node object or null if not found.
 */
export function getFolder(fileTree, path) {
  if (path === 'root') return fileTree;

  const parts = path.split('/');
  let curr = fileTree;

  for (const part of parts) {
    if (!curr.children[part] || curr.children[part].type !== 'folder') {
      return null;
    }
    curr = curr.children[part];
  }
  return curr;
}

// ----------------------------------------------------

/**
 * Clears and re-renders the file explorer UI based on the current file tree state.
 * Preserves keyboard focus across re-renders when the tree already had it (important
 * for remote/collaborative updates, which must NOT steal focus from elsewhere in the app).
 * When an item is being renamed inline, focus is instead handed to its rename input.
 * @param {Object} folder - The folder node to render.
 * @param {HTMLElement} container - The DOM element to inject the list into.
 * @param {string} [path=""] - Current recursion path for nested items.
 */
export function renderFileExplorer(folder, container = refs.imageList, path = '') {
  if (!container) return;

  const isRootCall = container === refs.imageList;
  const hadFocus = isRootCall && refs.imageList.contains(document.activeElement);

  container.innerHTML = '';
  renderTreeRecursive(folder, container, path, 0);

  if (isRootCall) {
    const items = Array.from(refs.imageList.querySelectorAll('[role="treeitem"]'));

    // A roving-tabindex tree always needs exactly one focusable item, even if the
    // previously selected path no longer exists in the freshly rendered tree.
    if (items.length > 0 && !items.some((el) => el.tabIndex === 0)) {
      items[0].tabIndex = 0;
    }

    if (renamingPath) {
      // An inline rename is in progress: hand focus to its input and select the text
      // so the user can immediately start typing over the current name.
      const match = items.find((el) => el.dataset.path === renamingPath);
      const input = match?.querySelector('.rename-input');
      if (input) {
        input.focus();
        input.select();
      }
    } else if (hadFocus) {
      const match = items.find((el) => el.dataset.path === lastClickedPath);
      (match || items[0])?.focus();
    }
  }
}

/**
 * Builds the inline text input used to rename a file or folder in place, replacing its
 * name label in the tree row. Enter commits, Escape cancels, and blur commits (so
 * clicking elsewhere behaves like a normal "click away to confirm" rename).
 * @param {string} fullPath - Path of the item being renamed.
 * @param {string} currentName - The item's current name, used as the input's starting value.
 * @returns {HTMLInputElement}
 */
function buildNameEditor(fullPath, currentName) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.className =
    'rename-input flex-1 min-w-0 text-[13px] leading-tight px-1 py-0.5 rounded ' +
    'border border-indigo-400 bg-white text-slate-800 shadow-sm ' +
    'focus:outline-none focus:ring-1 focus:ring-indigo-400';

  // Guards against the input's own blur firing (and re-committing) after Enter/Escape
  // has already settled the rename and triggered a re-render that removes it from the DOM.
  let settled = false;
  const finish = (commit) => {
    if (settled) return;
    settled = true;
    if (commit) {
      commitRename(fullPath, input.value);
    } else {
      cancelRename();
    }
  };

  input.addEventListener('keydown', (e) => {
    // Stop the tree's own keydown handling (arrow-key navigation, Delete-to-remove, F2, …)
    // from firing while the user is typing a new name.
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  });
  input.addEventListener('blur', () => finish(true));
  input.addEventListener('click', (e) => e.stopPropagation());
  input.addEventListener('dblclick', (e) => e.stopPropagation());
  input.addEventListener('mousedown', (e) => e.stopPropagation());

  return input;
}

/**
 * Core recursive engine that builds the DOM elements for the file tree.
 * Handles ARIA treeitem semantics, sorting, collapsible folders, drag events,
 * click listeners, and image hover previews.
 * @param {Object} folder - Current folder node being rendered.
 * @param {HTMLElement} container - The UL/DIV where items are appended.
 * @param {string} path - The accumulated path string for recursion.
 * @param {number} depth - Nesting depth, used for `aria-level`.
 */
function renderTreeRecursive(folder, container, path, depth) {
  const entries = Object.values(folder.children).sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  });

  if (depth > 0 && entries.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.setAttribute('role', 'none');
    emptyLi.className = 'pl-7 py-1 text-[11px] text-slate-400 italic select-none';
    emptyLi.textContent = 'Empty folder';
    container.appendChild(emptyLi);
    return;
  }

  entries.forEach((item) => {
    const fullPath = path ? `${path}/${item.name}` : item.name;
    const isSelected = fullPath === lastClickedPath;
    const isRenaming = fullPath === renamingPath;

    const li = document.createElement('li');
    li.setAttribute('role', 'treeitem');
    li.setAttribute('aria-level', String(depth + 1));
    li.setAttribute('aria-selected', String(isSelected));
    li.dataset.path = fullPath;
    li.dataset.type = item.type;
    li.style.listStyle = 'none';
    li.tabIndex = isSelected ? 0 : -1;
    li.draggable = canEdit && !isRenaming;
    li.className =
      'rounded-md transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400' +
      (isSelected ? ' selected-item' : '');

    const itemRow = document.createElement('div');
    itemRow.classList.add(
      'tree-item-row',
      'flex',
      'items-center',
      'gap-1.5',
      'px-1.5',
      'py-1',
      'rounded-md',
      'cursor-grab',
      'select-none',
      'hover:bg-slate-100',
    );

    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canEdit) return;
      applySelection(fullPath);
      showContextMenu(e, fullPath, item.type);
    });

    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('path', fullPath);
      e.stopPropagation();
      li.classList.add('opacity-50');
    });

    li.addEventListener('dragend', () => {
      li.classList.remove('opacity-50');
    });

    if (item.type === 'folder') {
      const isExpanded = expandedPaths.has(fullPath);
      li.setAttribute('aria-expanded', String(isExpanded));

      const chevronWrap = document.createElement('span');
      chevronWrap.className =
        'flex items-center justify-center w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-150' +
        (isExpanded ? ' rotate-90' : '');
      const chevron = createElement(ChevronRight);
      chevron.setAttribute('width', '12');
      chevron.setAttribute('height', '12');
      chevronWrap.appendChild(chevron);

      const folderIcon = createElement(isExpanded ? FolderOpen : Folder);
      folderIcon.setAttribute('width', '16');
      folderIcon.setAttribute('height', '16');
      folderIcon.classList.add('shrink-0', 'text-slate-500');

      const nameOrEditor = isRenaming
        ? buildNameEditor(fullPath, item.name)
        : (() => {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'text-[13px] font-medium text-slate-700 truncate';
            nameSpan.textContent = item.name;
            nameSpan.title = fullPath;
            return nameSpan;
          })();

      itemRow.append(chevronWrap, folderIcon, nameOrEditor);

      li.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!canEdit) return;
        itemRow.classList.add('bg-indigo-50', 'ring-1', 'ring-indigo-200');
      });
      li.addEventListener('dragleave', () => {
        itemRow.classList.remove('bg-indigo-50', 'ring-1', 'ring-indigo-200');
      });
      li.addEventListener('drop', (e) => {
        e.preventDefault();
        itemRow.classList.remove('bg-indigo-50', 'ring-1', 'ring-indigo-200');
        if (!canEdit) return;
        const sourcePath = e.dataTransfer.getData('path');
        if (sourcePath) moveItem(sourcePath, fullPath, fileTree);
      });

      itemRow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isRenaming) return;
        selectedFolderPath = fullPath;
        toggleExpand(fullPath, !isExpanded);
      });

      li.appendChild(itemRow);

      const group = document.createElement('ul');
      group.setAttribute('role', 'group');
      group.style.marginLeft = '18px';
      li.appendChild(group);

      if (isExpanded) {
        renderTreeRecursive(item, group, fullPath, depth + 1);
      }
    } else {
      // Fixed-width spacer so file names align with folder names (which have a chevron before them).
      const spacer = document.createElement('span');
      spacer.className = 'w-3.5 h-3.5 shrink-0';
      itemRow.appendChild(spacer);

      const iconWrap = document.createElement('span');
      iconWrap.className = 'shrink-0 flex items-center';
      iconWrap.innerHTML = getIcon(item.name, item.isMain);
      itemRow.appendChild(iconWrap);

      if (isRenaming) {
        const input = buildNameEditor(fullPath, item.name);
        itemRow.appendChild(input);
      } else {
        const nameSpan = document.createElement('span');
        nameSpan.className =
          'text-[13px] truncate ' +
          (item.isMain ? 'font-semibold text-slate-800' : 'text-slate-600');
        nameSpan.textContent = item.name;
        nameSpan.title = fullPath;
        itemRow.appendChild(nameSpan);

        if (item.isMain) {
          const badge = document.createElement('span');
          badge.className =
            'ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-wide text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded';
          badge.textContent = 'Main';
          itemRow.appendChild(badge);
        }
      }

      if (fullPath === activeFilePath) {
        li.classList.add('active-item');
        itemRow.classList.add('bg-indigo-50');
      }

      const ext = item.name.split('.').pop().toLowerCase();
      const isStandardImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

      if (isStandardImage && item.data) {
        itemRow.addEventListener('mouseenter', (e) => {
          // Defensive: a re-render while hovering (e.g. a remote change) could otherwise
          // leave an orphaned preview behind, since its mouseleave would never fire.
          document.getElementById('image-hover-preview')?.remove();

          const preview = document.createElement('div');
          preview.id = 'image-hover-preview';

          Object.assign(preview.style, {
            position: 'fixed',
            left: `${e.clientX + 20}px`,
            top: `${e.clientY - 20}px`,
            zIndex: '1000',
            padding: '4px',
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
            pointerEvents: 'none',
          });

          preview.innerHTML = `
                        <img src="${item.data}" 
                            style="max-width: 200px; max-height: 200px; display: block; border-radius: 4px;" 
                        />`;
          document.body.appendChild(preview);
        });

        itemRow.addEventListener('mousemove', (e) => {
          const preview = document.getElementById('image-hover-preview');
          if (preview) {
            preview.style.left = `${e.clientX + 20}px`;
            preview.style.top = `${e.clientY - 20}px`;
          }
        });

        itemRow.addEventListener('mouseleave', () => {
          document.getElementById('image-hover-preview')?.remove();
        });
      }

      itemRow.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isRenaming) return;
        applySelection(fullPath);
        openFileAndTrack(fullPath);
      });
      li.appendChild(itemRow);
    }

    container.appendChild(li);
  });
}

// ----------------------------------------------------

/**
 * Logic for moving an item between folders. Updates internal paths,
 * migrates tracked UI state (selection/active file/expansion), triggers a
 * re-render, saves to DB, and broadcasts via Socket.IO.
 */
async function moveItem(sourcePath, destFolderPath, fileTree) {
  const srcParts = sourcePath.split('/').filter((x) => x);
  const name = srcParts[srcParts.length - 1];
  const sourceParentPath = srcParts.slice(0, -1).join('/') || 'root';

  // Dropped back onto its current parent: no-op (also avoids a false "already exists" toast,
  // since the item would still be found in its own future destination at this point).
  if (destFolderPath === sourceParentPath) return;

  // Proper segment-boundary check: a plain `startsWith` would also (wrongly) block moving
  // "foo" into "foobar", since the string "foobar" starts with "foo".
  if (destFolderPath === sourcePath || destFolderPath.startsWith(`${sourcePath}/`)) {
    makeToast("Can't move a folder into itself", 'error');
    return;
  }

  const sourceParent = getFolder(fileTree, sourceParentPath);
  const destFolder = getFolder(fileTree, destFolderPath);

  if (!sourceParent || !destFolder) return;

  const item = sourceParent.children[name];
  if (!item) return;

  if (destFolder.children[name]) {
    makeToast('A file with this name already exist in this folder', 'error');
    return;
  }

  delete sourceParent.children[name];
  updatePaths(item, destFolderPath);
  destFolder.children[name] = item;

  const newPath = destFolderPath === 'root' ? name : `${destFolderPath}/${name}`;
  migratePathState(sourcePath, newPath);
  if (destFolderPath !== 'root') expandedPaths.add(destFolderPath);

  await saveFileTree();
  renderFileExplorer(fileTree);
  fetchCompile();

  if (refs.socket?.connected) {
    const oldSocketPath = `root/${sourcePath}`;
    const newSocketPath = `root/${destFolderPath === 'root' ? '' : destFolderPath + '/'}${name}`;
    refs.socket.emit('rename-node', {
      docId: currentProjectId,
      oldPath: oldSocketPath,
      newPath: newSocketPath,
    });
  }
}

/**
 * Recursively updates the 'fullPath' property of a node and all its children.
 * Necessary after a move or rename operation to maintain tree integrity.
 * @param {Object} item - The node (file or folder) to update.
 * @param {string} newFolderPath - The new parent folder path.
 */
function updatePaths(item, newFolderPath) {
  if (item.type === 'file') {
    item.fullPath = newFolderPath === 'root' ? item.name : `${newFolderPath}/${item.name}`;
  } else if (item.type === 'folder') {
    Object.values(item.children).forEach((child) =>
      updatePaths(child, newFolderPath === 'root' ? item.name : `${newFolderPath}/${item.name}`),
    );
  }
}

/**
 * Permanently deletes an item (after user confirmation), updates the UI,
 * clears any stale tracked UI state, and notifies collaborative peers.
 * @param {string} path - Path of the item to delete.
 * @param {Object} fileTree - Reference to the global file tree.
 */
export async function deleteItem(path, fileTree) {
  if (!canEdit) return;

  const parts = path.split('/').filter((x) => x);
  const name = parts[parts.length - 1];
  const parentPath = parts.slice(0, -1).join('/') || 'root';
  const parent = getFolder(fileTree, parentPath);

  if (!parent || !parent.children[name]) return;

  if (parent.children[name].type === 'file' && parent.children[name].isMain) {
    makeToast('Cannot delete the main file. Set another file as main first.', 'error');
    return;
  }

  const itemType = parent.children[name].type;
  const confirmed = await functions.openCustomConfirm(
    itemType === 'folder' ? 'Delete folder' : 'Delete file',
    itemType === 'folder'
      ? `Delete folder "${name}" and everything inside it? This can't be undone.`
      : `Delete "${name}"? This can't be undone.`,
  );

  if (!confirmed) return;

  delete parent.children[name];
  clearPathState(path);

  await saveFileTree();
  renderFileExplorer(fileTree);
  fetchCompile();

  if (refs.socket?.connected) {
    refs.socket.emit('delete-node', { docId: currentProjectId, path: `root/${path}` });
  }
}

// ----------------------------------------------------

/**
 * Persists the current state of the file tree to the server database.
 * @async
 */
async function saveFileTree() {
  await persistFileTree(fileTree);
}

// ----------------------------------------------------
/**
 * Maps a file extension to a specific Lucide icon, colored by file type, and returns
 * its HTML string as a small rounded "chip": the icon on a softly tinted background
 * (~10% opacity of its accent color) so file types are recognizable at a glance.
 * The main file gets the app's indigo accent plus a subtle ring instead of its
 * extension color, so it still stands out as "the" entry point.
 * @param {string} filename - The name of the file to determine the icon for.
 * @param {boolean} [isMain] - Whether this file is the project's main/entry file.
 * @returns {string} The HTML string of the rendered icon chip.
 */
export function getIcon(filename, isMain) {
  const ext = filename.includes('.')
    ? filename.split('.').pop().toLowerCase()
    : filename.toLowerCase();

  const config = getExtensionConfig(ext);

  const color = isMain ? '#3b82f6' : config.color;

  const IconData = config.icon;

  const svgElement = createElement(IconData);

  svgElement.setAttribute('width', '15');
  svgElement.setAttribute('height', '15');
  svgElement.setAttribute('stroke', color);
  svgElement.setAttribute('stroke-width', isMain ? '2.5' : '2');
  svgElement.style.verticalAlign = 'middle';

  const chip = document.createElement('span');

  chip.className =
    'inline-flex items-center justify-center rounded-md mr-2 shrink-0';

  Object.assign(chip.style, {
    width: '22px',
    height: '22px',
    backgroundColor: `${color}1A`,
  });

  if (isMain) {
    chip.style.boxShadow = `0 0 0 1px ${color}66 inset`;
  }

  chip.appendChild(svgElement);

  return chip.outerHTML;
}

// ----------------------------------------------------

/**
 * Triggers a prompt to create a new file in the currently selected folder.
 * Automatically appends '.typ' if no extension is provided.
 * @async
 */
async function createFile() {
  functions.openCustomPrompt('Enter new file name', async (fileName) => {
    if (!fileName || fileName.trim() === '') return;

    if (!fileName.includes('.')) {
      fileName += '.typ';
    }

    const targetFolder = getFolder(fileTree, selectedFolderPath);
    if (!targetFolder || targetFolder.children[fileName]) {
      makeToast(`Error creating file`, 'error');
      return;
    }

    const newFilePath =
      selectedFolderPath === 'root' ? fileName : `${selectedFolderPath}/${fileName}`;
    targetFolder.children[fileName] = {
      type: 'file',
      name: fileName,
      fullPath: newFilePath,
      data: '',
    };

    lastClickedPath = newFilePath;
    renderFileExplorer(fileTree);

    await saveFileTree();

    openFileAndTrack(newFilePath);

    if (refs.socket?.connected) {
      const socketPath =
        selectedFolderPath === 'root'
          ? `root/${fileName}`
          : `root/${selectedFolderPath}/${fileName}`;
      refs.socket.emit('create-node', { docId: currentProjectId, path: socketPath, type: 'file' });
    }
  });
}

// ----------------------------------------------------

/**
 * Triggers the custom context menu at the mouse position.
 * @param {MouseEvent} e - The original click event.
 * @param {string} path - The path of the item targeted by the right-click.
 * @param {'file'|'folder'} type - The type of the targeted item.
 */
function showContextMenu(e, path, type) {
  if (window.showContextMenu) window.showContextMenu(e, path, type);
}

/**
 * Enters inline-rename mode for an item: the tree re-renders with that item's name
 * replaced by a text input (see `buildNameEditor`), focused and pre-selected.
 * Replaces the previous prompt()-based flow — call this the same way as before
 * (e.g. from the context menu or the F2 shortcut); `commitRename`/`cancelRename`
 * take over from there once the user finishes editing.
 * @param {string} path - The current path of the item to be renamed.
 */
export function renameItem(path) {
  if (!canEdit) return;
  renamingPath = path;
  lastClickedPath = path;
  renderFileExplorer(fileTree);
}

/**
 * Applies a rename entered via the inline editor: validates the new name, updates the
 * tree, migrates tracked UI state, saves, exits rename mode, and notifies other users.
 * An empty or unchanged name is treated as a cancel rather than an error.
 * @param {string} oldPath - Path of the item being renamed.
 * @param {string} rawNewName - Raw value typed into the rename input.
 */
async function commitRename(oldPath, rawNewName) {
  renamingPath = null;

  const newName = rawNewName.trim();
  const parts = oldPath.split('/').filter((x) => x);
  const oldName = parts[parts.length - 1];

  if (!newName || newName === oldName) {
    renderFileExplorer(fileTree);
    return;
  }

  const parentPath = parts.slice(0, -1).join('/') || 'root';
  const parent = getFolder(fileTree, parentPath);

  if (!parent || parent.children[newName]) {
    makeToast('Error renaming', 'error');
    renderFileExplorer(fileTree);
    return;
  }

  const item = parent.children[oldName];

  delete parent.children[oldName];

  item.name = newName;
  updatePaths(item, parentPath);
  parent.children[newName] = item;

  const newPath = parentPath === 'root' ? newName : `${parentPath}/${newName}`;
  migratePathState(oldPath, newPath);
  lastClickedPath = newPath;

  await saveFileTree();
  renderFileExplorer(fileTree);

  if (refs.socket?.connected) {
    const oldSocketPath = `root/${oldPath}`;
    const newSocketPath = `root/${parentPath === 'root' ? '' : parentPath + '/'}${newName}`;
    refs.socket.emit('rename-node', {
      docId: currentProjectId,
      oldPath: oldSocketPath,
      newPath: newSocketPath,
    });
  }
}

/**
 * Exits inline-rename mode without applying any change (Escape key).
 */
function cancelRename() {
  renamingPath = null;
  renderFileExplorer(fileTree);
}

/**
 * Packages the entire project structure into a .zip file and triggers a download.
 * Handles both plain text and Base64 encoded (image) data.
 * @param {Object} fileTree - The project structure to export.
 * @param {string} projectName - The name of the resulting zip file.
 */
export async function exportZip(fileTree, projectName = 'project') {
  const zip = new JSZip();
  zipContent(zip, fileTree);
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
  makeToast('Project exported', 'success');
}

/**
 * Recursively traverses the file tree to populate a JSZip instance.
 * @param {Object} zip - The current JSZip folder instance.
 * @param {Object} folder - The local folder node to process.
 */
function zipContent(zip, folder) {
  Object.values(folder.children).forEach((item) => {
    if (item.type === 'folder') {
      zipContent(zip.folder(item.name), item);
    } else {
      let data = item.data;
      if (typeof data === 'string' && data.startsWith('data:')) {
        zip.file(item.name, data.split(',')[1], { base64: true });
      } else {
        zip.file(item.name, data || '');
      }
    }
  });
}

/**
 * Set a file as the main entry point for compilation and export.
 * Also reveals it in the tree by expanding its ancestor folders.
 * @param {string} path The path of the new entry point
 * @param {*} root The file tree
 */
export async function setMainFile(path, root) {
  if (!canEdit) return;
  syncFileTreeWithEditor();

  const clearMain = (node) => {
    if (node.type === 'file') {
      node.isMain = false;
    } else if (node.children) {
      Object.values(node.children).forEach(clearMain);
    }
  };

  clearMain(root);

  const parts = path.split('/').filter((x) => x);
  let current = root;
  const fileName = parts.pop();

  for (const part of parts) {
    current = current.children[part];
  }

  if (current.children[fileName]) {
    current.children[fileName].isMain = true;
    makeToast(`${fileName} is now the main file`, 'success');
  }

  if (refs.socket?.connected) {
    refs.socket.emit('set-main-file', {
      docId: currentProjectId,
      path: path,
    });
  }

  expandAncestors(path);
  lastClickedPath = path;
  activeFilePath = path;

  await saveFileTree();
  await openFile(path);
  renderFileExplorer(fileTree);
}
