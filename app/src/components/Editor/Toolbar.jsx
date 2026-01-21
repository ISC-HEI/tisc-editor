import { ArrowDownToLine, FolderOpen, Bold, Italic, Underline, Folders } from "lucide-react";

export const Toolbar = () => (
  <nav className="w-14 border-r border-slate-200 flex flex-col items-center py-4 gap-4 shrink-0 bg-slate-50/50">
    <div className="flex flex-col gap-2">
      <button id="btnSave" className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm hover:text-blue-600 transition-all text-slate-500" title="Save">
        <ArrowDownToLine size={20} />
      </button>
      <button id="btnOpen" className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm hover:text-blue-600 transition-all text-slate-500" title="Open">
        <FolderOpen size={20} />
      </button>
      <input type="file" id="fileInput" className="hidden" />
    </div>

    <div className="w-8 h-[1px] bg-slate-200" />

    <div className="flex flex-col gap-2">
      <button id="btnBold" className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-500" title="Bold"><Bold size={18} /></button>
      <button id="btnItalic" className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-500" title="Italic"><Italic size={18} /></button>
      <button id="btnUnderline" className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-500" title="Underline"><Underline size={18} /></button>
    </div>

    <div className="w-8 h-[1px] bg-slate-200" />

    <button id="btnShowImages" className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm hover:text-blue-600 transition-all text-slate-500" title="Files Explorer">
      <Folders size={20} />
    </button>
  </nav>
);