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
    title: null
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