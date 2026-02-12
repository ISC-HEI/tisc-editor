import { X, FolderPlus, Plus, FilePlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { deleteItem, renameItem, useFileManagerWatcher } from "@/hooks/useFileManager";
import { initPreviewRefs } from "@/hooks/refs";
import ContextMenu from "./ContextMenu"
import { fileTree } from "@/hooks/useEditor";

export function FileExplorer() {
  const imageListRef = useRef(null);
  const btnCloseImagesRef = useRef(null);
  const imageExplorerRef = useRef(null);
  const btnCreateFolderRef = useRef(null);
  const btnCreateFileRef = useRef(null);
  const btnUploadImagesRef = useRef(null);
  const imageFilesInputRef = useRef(null);
  const rootDropZoneRef = useRef(null);

  const [menuConfig, setMenuConfig] = useState({ x: 0, y: 0, path: "", type: "  " });
  const closeMenu = () => setMenuConfig({ x: 0, y: 0, path: "", type: "" });

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
        rootDropZone: rootDropZoneRef.current
      });
    }

    window.showContextMenu = (e, path, type) => {
      setMenuConfig({ x: e.clientX, y: e.clientY, path, type });
    };
  }, []);

  return (
    <div 
      ref={imageExplorerRef} 
      className="absolute left-0 top-0 bottom-0 w-72 bg-white border-r border-slate-200 shadow-xl z-20 flex flex-col transition-transform duration-300 transform" 
      style={{ display: "none" }}
    >
    <ContextMenu 
        {...menuConfig} 
        targetPath={menuConfig.path}
        onClose={closeMenu}
        onRename={(path) => renameItem(path)} 
        onDelete={(path) => deleteItem(path, fileTree)}
      />
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 italic">Explorer</h3>
        <div className="flex items-center gap-1">
          <button 
            ref={btnCreateFileRef} 
            title="New Typst File"
            className="p-1.5 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"
          >
            <FilePlus size={16} />
          </button>
          <button 
            ref={btnCreateFolderRef} 
            title="New Folder"
            className="p-1.5 hover:bg-slate-200 rounded-md text-slate-600 transition-colors"
          >
            <FolderPlus size={16} />
          </button>
          <button 
            ref={btnCloseImagesRef} 
            className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-md ml-1 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="p-3">
        <button 
          ref={btnUploadImagesRef} 
          className="w-full flex items-center justify-center gap-2 text-xs font-semibold p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md shadow-blue-100"
        >
          <Plus size={14} /> Import Media
        </button>
      </div>
      <input 
        ref={imageFilesInputRef} 
        type="file" 
        className="hidden" 
        multiple 
      />
      <div 
        ref={rootDropZoneRef} 
        className="mx-3 p-2 text-[10px] font-bold uppercase bg-slate-100 rounded text-slate-400 mb-2 flex items-center gap-2 border border-dashed border-slate-200"
      >
        <span className="text-sm">🏠</span> Root Project
      </div>

      <ul 
        ref={imageListRef} 
        className="flex-1 overflow-y-auto px-2 pb-4 space-y-1 scrollbar-thin scrollbar-thumb-slate-200"
      >
      </ul>
    </div>
  );
}