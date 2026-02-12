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

  separator: null,
};

export let infos = {
    currentProjectId: null,
    defaultFileTree: null
}

export let functions = {
  openCustomPrompt: null
}

export const initPreviewRefs = (elements) => {
  refs = { ...refs, ...elements };
};

export const initPreviewInfos = (elements) => {
  infos = { ...infos, ...elements };
}

export const initPreviewFunctions = (elements) => {
  functions = { ...functions, ...elements };
}