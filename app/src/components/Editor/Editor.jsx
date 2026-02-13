"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { EditorHeader } from "./EditorHeader";
import { Toolbar } from "./Toolbar.jsx";
import { FileExplorer } from "./FileExplorer";
import { PreviewPane } from "./PreviewPane";
import { PromptModal } from "./PromptModal";
import Breadcrumbs from "./Breadcrumbs";
import { initPreviewFunctions, initPreviewInfos, initPreviewRefs, refs } from "@/hooks/refs";
import { currentFilePath, isLoadingFile, useEditorWatcher } from "@/hooks/useEditor";
import { useTypstCollaboration } from "@/hooks/useTypstCollaboration";

const MonacoEditor = dynamic(
  () => import("./MonacoEditor").then((mod) => mod.MonacoEditor),
  { ssr: false }
);

export default function Editor({ projectId, title, fileTree, userId }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: "", callback: null });
  const [inputValue, setInputValue] = useState("");
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const separatorRef = useRef(null);
  const [activePath, setActivePath] = useState("root/main.typ");
  
  const { content, updateContent } = useTypstCollaboration(projectId, userId, fileTree);

  useEditorWatcher();

  const handleEditorReady = async (instance) => {
    if (instance && separatorRef.current) {
      initPreviewRefs({
        editor: instance,
        separator: separatorRef.current
      });
    }
    initPreviewInfos({
      currentProjectId: projectId,
      defaultFileTree: fileTree
    });
    initPreviewFunctions({
      openCustomPrompt: openCustomPrompt
    });
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


useEffect(() => {
    const onDragOver = (e) => {
      const isFile = e.dataTransfer.types.includes("Files");
      
      if (isFile) {
        e.preventDefault();
        setIsDraggingGlobal(true);
      }
    };

    const onDragLeave = (e) => {
      if (e.relatedTarget === null) {
        setIsDraggingGlobal(false);
      }
    };

    const onDrop = (e) => {
      const isFile = e.dataTransfer.types.includes("Files");
      
      if (isFile) {
        e.preventDefault();
        setIsDraggingGlobal(false);
        
        const droppedFiles = e.dataTransfer.files;
        
        if (droppedFiles.length > 0 && refs.imageFilesInput) {
          const dataTransfer = new DataTransfer();
          Array.from(droppedFiles).forEach(file => {
            dataTransfer.items.add(file);
          });

          refs.imageFilesInput.files = dataTransfer.files;
          const event = new Event('change', { bubbles: true });
          refs.imageFilesInput.dispatchEvent(event);
        }
      } else {
        setIsDraggingGlobal(false);
      }
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);

    import("../../hooks/useEditor").then(mod => {
      mod.setOnPathChange((newPath) => {
        setActivePath("root/" + newPath);
      });
    });

    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-white overflow-hidden text-slate-900">
    {isDraggingGlobal && (
      <div className="absolute inset-0 z-[100] p-8 pointer-events-none animate-in fade-in duration-200">
        <div className="w-full h-full border-4 border-dashed border-blue-500/50 rounded-[2rem] bg-blue-50/80 backdrop-blur-[2px] flex flex-col items-center justify-center">
          <h2 className="text-3xl font-bold text-blue-700 tracking-tight">
            Drop to upload
          </h2>
          <p className="text-blue-600/70 font-medium mt-2">
            Your files will be added to the project root
          </p>
        </div>
      </div>
    )}
      <EditorHeader title={title} />

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex flex-1 min-w-0 bg-white">
          <Toolbar />
          
          <div className="flex-1 relative min-w-0 overflow-hidden">
            <Breadcrumbs path={activePath} />
            <FileExplorer />
            <MonacoEditor
              content={fileTree?.children?.["main.typ"]?.data || ""} 
              onChange={(newContent) => {
                if (!isLoadingFile) {
                  updateContent(newContent); 
                }
              }} 
              onInstanceReady={handleEditorReady} 
            />
          </div>
        </div>

        <div ref={separatorRef} className="w-1.5 bg-slate-100 hover:bg-blue-200 cursor-col-resize shrink-0 border-x border-slate-200" />

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