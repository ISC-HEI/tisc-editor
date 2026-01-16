"use client";
import { useEffect, useRef, useState } from "react";
import * as monaco from "monaco-editor";
import { 
  ArrowDownToLine, Bold, FolderOpen, Folders, Italic, 
  Underline, ZoomIn, ZoomOut, ChevronLeft, FileText,
  Download, X, Plus, FolderPlus
} from "lucide-react";
import { SignOutButton } from "./SignOutButton";

export default function Editor({ projectId, title, content, fileTree }) {
  const editorRef = useRef(null);
  const monacoInstance = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: "", callback: null });
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initApp = async () => {
      if (editorRef.current && !monacoInstance.current) {
        monacoInstance.current = monaco.editor.create(editorRef.current, {
          value: content || "",
          language: "pug",
          theme: "vs-light",
          automaticLayout: true,
          fontSize: 14,
          fontFamily: "'Fira Code', monospace",
          minimap: { enabled: false },
          lineNumbers: "on",
          roundedSelection: true,
          scrollBeyondLastLine: false,
          padding: { top: 16 },
          lineNumbersMinChars: 3
        });
      }

      try {
        const [EditorScript, ZoomScript, FileMgrScript] = await Promise.all([
          import("../assets/script/editor.js"),
          import("../assets/script/zoom.js"),
          import("../assets/script/fileManager.js"),
        ]);

        const btnBold = document.getElementById("btnBold");
        if (!btnBold) return;

        EditorScript.initEditorListeners(
          monacoInstance.current,
          projectId,
          fileTree,
          btnBold,
          document.getElementById("btnItalic"),
          document.getElementById("btnUnderline"),
          document.getElementById("btnSave"),
          document.getElementById("btnOpen"),
          document.getElementById("fileInput"),
          document.getElementById("btnExportPdf"),
          document.getElementById("btnExportSvg")
        );

        ZoomScript.initZoom(
          document.getElementById("btnZoomIn"),
          document.getElementById("btnZoomOut")
        );

        FileMgrScript.initFileManager(
          document.getElementById("btnShowImages"),
          document.getElementById("btnCloseImages"),
          document.getElementById("btnCreateFolder"),
          document.getElementById("btnUploadImages"),
          document.getElementById("imageFilesInput"),
          document.getElementById("rootDropZone"),
          openCustomPrompt
        );

        EditorScript.fetchCompile();

      } catch (error) {
        console.error("Erreur chargement modules :", error);
      }
    };

    initApp();

    return () => {
      if (monacoInstance.current) {
        monacoInstance.current.dispose();
        monacoInstance.current = null;
      }
    };
  }, [projectId]);

  const openCustomPrompt = (title, callback) => {
    setModalConfig({ title, callback });
    setInputValue("");
    setIsModalOpen(true);
  };

  const handleModalConfirm = () => {
    if (inputValue.trim() && modalConfig.callback) {
      modalConfig.callback(inputValue);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden text-slate-900">
      
      <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 shrink-0 bg-white z-10">
        <div className="flex items-center gap-4">
          <a 
            href="/dashboard" 
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            title="Back to Dashboard"
          >
            <ChevronLeft size={20} />
          </a>
          <div className="h-6 w-[1px] bg-slate-200 mx-1" />
          <div className="flex items-center gap-2">
            <div className="bg-blue-50 text-blue-600 p-1.5 rounded">
              <FileText size={16} />
            </div>
            <h1 className="font-semibold text-sm tracking-tight">{title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SignOutButton />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        
        <div className="flex flex-1 min-w-0 bg-white">
          
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

          <div className="flex-1 relative min-w-0 overflow-hidden">
            <div id="imageExplorer" className="absolute left-0 top-0 bottom-0 w-72 bg-white border-r border-slate-200 shadow-xl z-20 flex flex-col transition-transform duration-300 transform" style={{ display: "none" }}>
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-500">Explorer</h3>
                <button id="btnCloseImages" className="p-1 hover:bg-slate-200 rounded-md"><X size={18} /></button>
              </div>
              <div className="p-3 grid grid-cols-2 gap-2">
                <button id="btnCreateFolder" className="flex items-center justify-center gap-2 text-xs font-medium p-2 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:text-blue-600 transition-all">
                  <FolderPlus size={14} /> Folder
                </button>
                <button id="btnUploadImages" className="flex items-center justify-center gap-2 text-xs font-medium p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all">
                  <Plus size={14} /> File
                </button>
              </div>
              <input type="file" id="imageFilesInput" className="hidden" multiple />
              <div id="rootDropZone" className="mx-3 p-2 text-xs font-semibold bg-slate-100 rounded text-slate-600 mb-2">🏠 Root Project</div>
              <ul id="imageList" className="flex-1 overflow-y-auto px-2 space-y-1"></ul>
            </div>

            <div ref={editorRef} className="h-full w-full" />
          </div>
        </div>

        <div id="separator" className="w-1.5 bg-slate-100 hover:bg-blue-200 cursor-col-resize transition-colors shrink-0 border-x border-slate-200" />

        <div className="flex-1 bg-slate-100 overflow-hidden flex flex-col">
          <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button id="btnZoomOut" className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-600"><ZoomOut size={16} /></button>
              <span id="zoomLevel" className="text-[11px] font-bold px-3 min-w-[50px] text-center text-slate-500">100%</span>
              <button id="btnZoomIn" className="p-1 hover:bg-white hover:shadow-sm rounded transition-all text-slate-600"><ZoomIn size={16} /></button>
            </div>
            
            <div className="flex gap-2">
              <button id="btnExportPdf" className="flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
                <Download size={14} /> PDF
              </button>
              <button id="btnExportSvg" className="flex items-center gap-2 text-[12px] font-semibold py-1.5 px-3 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all">
                <Download size={14} /> SVG
              </button>
            </div>
          </div>
          
          <div id="preview" className="flex-1 overflow-auto p-8 flex justify-center">
            <div id="page" className="bg-white shadow-2xl origin-top transition-transform duration-200 min-h-[29.7cm] w-[21cm]">
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-80 border border-slate-200 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold mb-4 text-slate-900 leading-tight">{modalConfig.title}</h3>
            <input 
              autoFocus
              placeholder="Enter name..."
              className="w-full px-4 py-2 border border-slate-200 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleModalConfirm()}
            />
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleModalConfirm}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}