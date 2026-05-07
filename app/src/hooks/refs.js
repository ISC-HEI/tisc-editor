/**
 * Global references to DOM elements and editor instances.
 * Used to provide direct access across hooks.
 */
export let refs = {
  page: null,
  editor: null,

  btnZoomIn: null,
  btnZoomOut: null,
  zoomLevelDisplay: null,

  btnSave: null,
  btnOpen: null,
  btnBold: null,
  btnItalic: null,
  btnUnderline: null,
  btnExportZip: null,
  btnExportPdf: null,
  btnExportSvg: null,
  btnCreateFile: null,
  btnLang: null,

  fileInputOpen: null,

  imageList: null,
  imageExplorer: null,
  btnShowImages: null,
  btnCloseImages: null,
  btnCreateFolder: null,
  btnUploadImages: null,
  imageFilesInput: null,
  rootDropZone: null,
  userCount: null,
  userListContainer: null,

  separator: null,

  contextMenu: null
};

/**
 * State and configuration metadata for the current project session.
 */
export let infos = {
    currentProjectId: null,
    defaultFileTree: null,
    title: null,
    logs: []
}

/**
 * Shared utility functions that need to be accessible globally.
 */
export let functions = {
  openCustomPrompt: null,
  syncCollaboration: null
}

/**
 * Updates the global refs object with new DOM elements or instances.
 * @param {Object} elements - An object containing the references to update.
 */
export const initPreviewRefs = (elements) => {
  refs = { ...refs, ...elements };
};

/**
 * Initializes project-specific metadata.
 * @param {Object} elements - Metadata object (id, tree, title).
 */
export const initPreviewInfos = (elements) => {
  infos = { ...infos, ...elements };
}

/**
 * Registers global callback functions.
 * @param {Object} elements - Function definitions.
 */
export const initPreviewFunctions = (elements) => {
  functions = { ...functions, ...elements };
}

export const applyLanguageToTypst = (langCode) => {
  if (!refs.editor) return;

  // 1. Injecter la règle dans le texte (pour Typst)
  const content = refs.editor.state?.doc?.toString() || refs.editor.getValue();
  const langRegex = /^#set text\(lang: ".*"\)\s*\n?/;
  const newRule = `#set text(lang: "${langCode}")\n`;
  
  let newContent = langRegex.test(content) 
    ? content.replace(langRegex, newRule) 
    : newRule + content;

  // Update texte
  if (refs.editor.dispatch) {
    refs.editor.dispatch({ changes: { from: 0, to: content.length, insert: newContent } });
  } else {
    refs.editor.setValue(newContent);
  }

  // 2. ACTIVER LE SPELLCHECK (Pour l'Issue #48)
  const editorElement = document.querySelector('.cm-content') || document.querySelector('.monaco-editor textarea');
  if (editorElement) {
    editorElement.setAttribute('lang', langCode);
    editorElement.setAttribute('spellcheck', 'true');
  }
};