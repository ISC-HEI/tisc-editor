/**
 * Global references to DOM elements and editor instances.
 * Used to provide direct access across hooks.
 */
export let refs = {
  page: null,
  editor: null,

  previewContainer: null,

  btnZoomIn: null,
  btnZoomOut: null,
  zoomLevelDisplay: null,

  btnSave: null,
  btnBold: null,
  btnItalic: null,
  btnUnderline: null,
  btnExportZip: null,
  btnExportPdf: null,
  btnExportSvg: null,
  btnCreateFile: null,
  btnLang: null,

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

  contextMenu: null,

  // Current editor font size in pixels (used to request scaled compilation)
  editorFontSize: 14,
};

/**
 * State and configuration metadata for the current project session.
 */
export let infos = {
  currentProjectId: null,
  defaultFileTree: null,
  title: null,
  logs: [],
};

/**
 * Shared utility functions that need to be accessible globally.
 */
export let functions = {
  openCustomPrompt: null,
  openCustomConfirm: null,
  syncCollaboration: null,
};

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
};

/**
 * Registers global callback functions.
 * @param {Object} elements - Function definitions.
 */
export const initPreviewFunctions = (elements) => {
  functions = { ...functions, ...elements };
};

export const applyLanguageToTypst = (langCode) => {
  const editor = refs.editor;
  if (!editor) return;

  const model = editor.getModel();
  const content = model.getValue();
  const langRegex = /^#set text\(lang: ".*"\)\s*\n?/;
  const newRule = `#set text(lang: "${langCode}")\n`;

  const newContent = langRegex.test(content)
    ? content.replace(langRegex, newRule)
    : newRule + content;

  editor.executeEdits('set-language', [{ range: model.getFullModelRange(), text: newContent }]);

  refs.spellcheck?.setLanguage(langCode);
};
