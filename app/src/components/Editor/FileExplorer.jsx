import { X, FolderPlus, Plus, FilePlus, Lock, FolderTree } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { deleteItem, renameItem, setMainFile, useFileManagerWatcher } from '@/hooks/useFileManager';
import { initPreviewRefs } from '@/hooks/refs';
import ContextMenu from './ContextMenu';
import { fileTree } from '@/hooks/useEditor';

export function FileExplorer({ canEdit = true }) {
  const imageListRef = useRef(null);
  const btnCloseImagesRef = useRef(null);
  const imageExplorerRef = useRef(null);
  const btnCreateFolderRef = useRef(null);
  const btnCreateFileRef = useRef(null);
  const btnUploadImagesRef = useRef(null);
  const imageFilesInputRef = useRef(null);
  const rootDropZoneRef = useRef(null);

  const [menuConfig, setMenuConfig] = useState({ x: 0, y: 0, path: '', type: '  ' });
  const closeMenu = () => setMenuConfig({ x: 0, y: 0, path: '', type: '' });

  useFileManagerWatcher();

  useEffect(() => {
    if (
      imageListRef.current &&
      btnCloseImagesRef.current &&
      imageExplorerRef.current &&
      btnCreateFolderRef.current &&
      btnCreateFileRef.current &&
      btnUploadImagesRef.current &&
      imageFilesInputRef.current &&
      rootDropZoneRef.current
    ) {
      initPreviewRefs({
        imageList: imageListRef.current,
        btnCloseImages: btnCloseImagesRef.current,
        imageExplorer: imageExplorerRef.current,
        btnCreateFolder: btnCreateFolderRef.current,
        btnCreateFile: btnCreateFileRef.current,
        btnUploadImages: btnUploadImagesRef.current,
        imageFilesInput: imageFilesInputRef.current,
        rootDropZone: rootDropZoneRef.current,
      });
    }

    window.showContextMenu = (e, path, type) => {
      if (!canEdit) return;
      setMenuConfig({ x: e.clientX, y: e.clientY, path, type });
    };
  }, [canEdit]);

  const disabledClass = 'opacity-30 cursor-not-allowed pointer-events-none';
  const toolbarBtnClass =
    'p-1.5 rounded-lg text-slate-600 transition-colors duration-150 ' +
    'hover:bg-slate-200/70 hover:text-slate-900 ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1';

  return (
    <div
      ref={imageExplorerRef}
      className="absolute left-0 top-0 bottom-0 w-72 bg-white border-r border-slate-200 shadow-xl z-20 flex flex-col transition-transform duration-300 transform"
      style={{ display: 'none' }}
    >
      {canEdit && (
        <ContextMenu
          {...menuConfig}
          targetPath={menuConfig.path}
          onClose={closeMenu}
          onRename={(path) => renameItem(path)}
          onDelete={(path) => deleteItem(path, fileTree)}
          onSetMain={(path) => setMainFile(path, fileTree)}
        />
      )}

      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2 min-w-0">
          <FolderTree size={15} className="text-slate-400 shrink-0" />
          <h3 className="font-semibold text-[13px] text-slate-700 truncate">Explorer</h3>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            ref={btnCreateFileRef}
            disabled={!canEdit}
            title={canEdit ? 'New Typst file' : 'Read-only mode'}
            aria-label="Create new file"
            className={`${toolbarBtnClass} ${!canEdit ? disabledClass : ''}`}
          >
            <FilePlus size={16} />
          </button>
          <button
            ref={btnCreateFolderRef}
            disabled={!canEdit}
            title={canEdit ? 'New folder' : 'Read-only mode'}
            aria-label="Create new folder"
            className={`${toolbarBtnClass} ${!canEdit ? disabledClass : ''}`}
          >
            <FolderPlus size={16} />
          </button>

          <span className="w-px h-4 bg-slate-200 mx-1" aria-hidden="true" />

          <button
            ref={btnCloseImagesRef}
            title="Close explorer"
            aria-label="Close explorer"
            className="p-1.5 rounded-lg text-slate-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Read-only notice — only takes up space when it matters */}
      {!canEdit && (
        <div className="mx-3 mt-3 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100 flex items-center gap-1.5">
          <Lock size={12} className="text-amber-500 shrink-0" />
          <span className="text-[11px] font-medium text-amber-700">
            Read-only — you don&apos;t have edit access
          </span>
        </div>
      )}

      {/* Primary action */}
      <div className="p-3 pb-2">
        <button
          ref={btnUploadImagesRef}
          disabled={!canEdit}
          title={canEdit ? 'Import images or media files' : 'Read-only mode'}
          aria-label="Import media"
          className={`w-full flex items-center justify-center gap-2 text-[13px] font-semibold py-2.5 rounded-lg
            bg-indigo-600 text-white shadow-sm shadow-indigo-200
            transition-all duration-150 hover:bg-indigo-700 active:scale-[0.98]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1
            disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-indigo-600 disabled:active:scale-100`}
        >
          <Plus size={14} /> Import media
        </button>
      </div>

      <input
        ref={imageFilesInputRef}
        type="file"
        className="hidden"
        multiple
        disabled={!canEdit}
        aria-hidden="true"
      />

      {/* Drop zone / root marker */}
      <div
        ref={rootDropZoneRef}
        className="mx-3 mb-2 px-2.5 py-2 text-[11px] font-medium text-slate-400 rounded-lg
          border border-dashed border-slate-200 bg-slate-50/70
          flex items-center gap-2 transition-colors duration-150"
      >
        <FolderTree size={12} className="shrink-0" />
        Root project
      </div>

      {/* File tree */}
      <ul
        ref={imageListRef}
        className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5 scrollbar-thin scrollbar-thumb-slate-200"
      ></ul>
    </div>
  );
}
