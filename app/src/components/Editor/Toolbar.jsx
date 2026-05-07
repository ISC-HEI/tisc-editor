import { ArrowDownToLine, FolderOpen, Bold, Italic, Underline, Folders, Languages } from "lucide-react";
import { useEditorWatcher } from "@/hooks/useEditor"
import { useEffect, useRef, useState } from "react";
import { functions, initPreviewRefs, applyLanguageToTypst} from "@/hooks/refs";

export function Toolbar() {
  const btnSaveRef = useRef(null)
  const btnOpenRef = useRef(null)
  const btnBRef = useRef(null)
  const btnIRef = useRef(null)
  const btnURef = useRef(null)
  const btnLangRef = useRef(null)
  const fileInputOpenRef = useRef(null)
  const btnShowImagesRef = useRef(null)

  const [isLangOpen, setIsLangOpen] = useState(false);

  useEditorWatcher();

  useEffect(() => {
    initPreviewRefs({
      btnSave: btnSaveRef.current,
      btnOpen: btnOpenRef.current,
      btnBold: btnBRef.current,
      btnItalic: btnIRef.current,
      btnUnderline: btnURef.current,
      btnLang: btnLangRef.current,
      fileInputOpen: fileInputOpenRef.current,
      btnShowImages: btnShowImagesRef.current
    });
    functions.openLanguageMenu = () => setIsLangOpen(true);
  }, []);

  return (
    <>
      <nav className="w-14 border-r border-slate-200 flex flex-col items-center py-4 gap-4 shrink-0 bg-slate-50/50">
        <div className="flex flex-col gap-2">
          <button ref={btnSaveRef} className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm hover:text-blue-600 transition-all text-slate-500" title="Save">
            <ArrowDownToLine size={20} />
          </button>
          <button ref={btnOpenRef} className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm hover:text-blue-600 transition-all text-slate-500" title="Open">
            <FolderOpen size={20} />
          </button>
          <input ref={fileInputOpenRef} type="file" className="hidden" />
        </div>
    
        <div className="w-8 h-[1px] bg-slate-200" />
    
        <div className="flex flex-col gap-2">
          <button ref={btnBRef} className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-500" title="Bold"><Bold size={18} /></button>
          <button ref={btnIRef} className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-500" title="Italic"><Italic size={18} /></button>
          <button ref={btnURef} className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm text-slate-500" title="Underline"><Underline size={18} /></button>
        </div>
    
        <div className="w-8 h-[1px] bg-slate-200" />
    
        <button ref={btnShowImagesRef} className="p-2.5 rounded-xl hover:bg-white hover:shadow-sm hover:text-blue-600 transition-all text-slate-500" title="Files Explorer">
          <Folders size={20} />
        </button>

        <button 
          ref={btnLangRef} 
          onClick={() => setIsLangOpen(!isLangOpen)} 
          className={`p-2.5 rounded-xl transition-all ${isLangOpen ? 'bg-blue-50 text-blue-600 shadow-inner' : 'hover:bg-white hover:shadow-sm text-slate-500'}`}
          title="Language"
        >
          <Languages size={18} />
        </button>
      </nav>

      {isLangOpen && (
        <div className="fixed left-14 top-0 h-full w-64 bg-white border-r border-slate-200 shadow-xl z-50 p-4 animate-in slide-in-from-left duration-200">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-700">Traduire le document</h3>
            <button 
              onClick={() => setIsLangOpen(false)}
              className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <button 
              className="flex justify-between items-center text-left p-3 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors group" 
              onClick={() => { applyLanguageToTypst('fr'); setIsLangOpen(false); }}
            >
              <span className="font-medium">Français</span>
              <span>🇫🇷</span>
            </button>

            <button 
              className="flex justify-between items-center text-left p-3 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors group" 
              onClick={() => { applyLanguageToTypst('en'); setIsLangOpen(false); }}
            >
              <span className="font-medium">English</span>
              <span>🇬🇧</span>
            </button>

            <button 
              className="flex justify-between items-center text-left p-3 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-colors group" 
              onClick={() => { applyLanguageToTypst('de'); setIsLangOpen(false); }}
            >
              <span className="font-medium">Deutsch</span>
              <span>🇩🇪</span>
            </button>
          </div>

          <div className="mt-8 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1">Info</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Cette option modifie la langue structurelle (titres, dates, biblio) de ton document Typst.
            </p>
          </div>
        </div>
      )}
    </>
  );
}