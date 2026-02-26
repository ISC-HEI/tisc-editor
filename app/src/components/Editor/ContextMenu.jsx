import { useEffect, useRef } from "react";
import { Crown, Edit2, Trash2 } from "lucide-react";
import { initPreviewRefs } from "@/hooks/refs";

function ContextMenu({ x, y, targetPath, type, onClose, onRename, onDelete, onSetMain }) {
  const menuRef = useRef(null);
  const isTypstFile = type === 'file' && targetPath?.toLowerCase().endsWith('.typ');

  useEffect(() => {
    const handleClickOutside = () => onClose();
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      initPreviewRefs({
        contextMenu: menuRef.current
      });
    }
  }, []);

  if (x === 0 && y === 0) return null;

  return (
    <div 
      ref={menuRef}
      className="fixed z-[100] w-48 bg-white border border-slate-200 shadow-2xl rounded-lg overflow-hidden py-1 animate-in fade-in zoom-in duration-100"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 mb-1">
        {type === 'folder' ? 'Folder' : 'File'} Actions
      </div>

      <button 
        onClick={() => { onRename(targetPath); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
      >
        <Edit2 size={14} />
        <span>Rename</span>
        <span className="ml-auto text-[10px] text-slate-400">F2</span>
      </button>

      {isTypstFile && (
        <button
          onClick={() => { onSetMain(targetPath); onClose(); }}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
        >
          <Crown size={14} className="text-amber-500" />
          <span>Set as main file</span>
        </button>
      )}

      <button 
        onClick={() => { onDelete(targetPath); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
      >
        <Trash2 size={14} />
        <span>Delete</span>
      </button>
    </div>
  );
}

export default ContextMenu;