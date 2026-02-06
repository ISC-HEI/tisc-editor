"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";

import { EditorHeader } from "./EditorHeader";
import { Toolbar } from "./Toolbar.jsx";
import { FileExplorer } from "./FileExplorer";
import { PreviewPane } from "./PreviewPane";
import { PromptModal } from "./PromptModal";
import { initPreviewFunctions, initPreviewInfos, initPreviewRefs } from "@/hooks/refs";
import { useEditorWatcher } from "@/hooks/useEditor";
import { useTypstCollaboration } from "@/hooks/useTypstCollaboration";

const MonacoEditor = dynamic(
  () => import("./MonacoEditor").then((mod) => mod.MonacoEditor),
  { ssr: false }
);

export default function Editor({ projectId, title, content: initialContent, fileTree, userId }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: "", callback: null });
  const [inputValue, setInputValue] = useState("");
  const separatorRef = useRef(null);
  
  const { content, updateContent } = useTypstCollaboration(projectId, userId, initialContent);

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
              onChange={updateContent} 
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