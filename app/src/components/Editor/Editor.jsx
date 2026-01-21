"use client";
import {useState } from "react";
import dynamic from "next/dynamic";

import { EditorHeader } from "./EditorHeader";
import { Toolbar } from "./Toolbar.jsx";
import { FileExplorer } from "./FileExplorer";
import { PreviewPane } from "./PreviewPane";
import { PromptModal } from "./PromptModal";

const MonacoEditor = dynamic(
  () => import("./MonacoEditor").then((mod) => mod.MonacoEditor),
  { ssr: false }
);

export default function Editor({ projectId, title, content, fileTree }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: "", callback: null });
  const [inputValue, setInputValue] = useState("");

  const handleEditorReady = async (instance) => {
    try {
      const [EditorScript, ZoomScript, FileMgrScript] = await Promise.all([
        import("../../assets/script/editor.js"),
        import("../../assets/script/zoom.js"),
        import("../../assets/script/fileManager.js"),
      ]);

      EditorScript.initEditorListeners(
        instance, projectId, fileTree,
        document.getElementById("btnBold"),
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
      console.error("Erreur chargement scripts :", error);
    }
  };

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
      <EditorHeader title={title} />

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex flex-1 min-w-0 bg-white">
          <Toolbar />
          
          <div className="flex-1 relative min-w-0 overflow-hidden">
            <FileExplorer />
            <MonacoEditor 
              content={content} 
              onInstanceReady={handleEditorReady} 
            />
          </div>
        </div>

        <div id="separator" className="w-1.5 bg-slate-100 hover:bg-blue-200 cursor-col-resize shrink-0 border-x border-slate-200" />

        <PreviewPane />
      </div>

      <PromptModal 
        isOpen={isModalOpen}
        title={modalConfig.title}
        value={inputValue}
        onChange={setInputValue}
        onConfirm={handleModalConfirm}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}