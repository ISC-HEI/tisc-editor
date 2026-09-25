'use client';
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

import { EditorHeader } from './EditorHeader';
import { Toolbar } from './Toolbar.jsx';
import { FileExplorer } from './FileExplorer';
import { PreviewPane } from './PreviewPane';
import { PromptModal } from './PromptModal';
import Breadcrumbs from './Breadcrumbs';
import PaneLog from '../../components/Editor/PaneLog';
import { initPreviewFunctions, initPreviewInfos, initPreviewRefs, refs } from '@/hooks/refs';
import { isLoadingFile, setCanEdit, useEditorWatcher } from '@/hooks/useEditor';
import { useTypstCollaboration } from '@/hooks/useTypstCollaboration';
import { findMainFile } from '@/hooks/useApi';

const MonacoEditor = dynamic(() => import('./MonacoEditor').then((mod) => mod.MonacoEditor), {
  ssr: false,
});

export default function Editor({ projectId, title, fileTree, userId, tags, canEdit = true }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', callback: null });
  const [inputValue, setInputValue] = useState('');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmModalConfig, setConfirmModalConfig] = useState({
    title: '',
    message: '',
    resolve: null,
  });

  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [editorFontSize, setEditorFontSize] = useState(14);
  const [wordWrap, setWordWrap] = useState(false);
  const separatorRef = useRef(null);

  useEffect(() => {
    setCanEdit(canEdit);
  }, [canEdit]);

  const handleFontSizeChange = (size) => {
    setEditorFontSize(size);

    const editor = refs.editor;
    if (!editor) return;

    const selection = editor.getSelection();
    const model = editor.getModel();
    const selectedText = model.getValueInRange(selection);

    if (!selectedText.trim()) {
      const newContent = `#set text(size: ${size}pt)\n` + model.getValue();
      updateContent(newContent);
      return;
    }

    const wrapped = `#text(size: ${size}pt)[${selectedText}]`;

    editor.executeEdits(null, [
      {
        range: selection,
        text: wrapped,
        forceMoveMarkers: true,
      },
    ]);

    updateContent(model.getValue());
  };

  const handleWordWrapChange = (enabled) => {
    setWordWrap(enabled);
  };

  const [activePath, setActivePath] = useState(() => {
    const path = findMainFile(fileTree) || 'main.typ';
    return 'root/' + path;
  });

  const { updateContent, updateCursor } = useTypstCollaboration(projectId, userId, fileTree);

  useEditorWatcher();

  const handleEditorReady = async (instance) => {
    if (instance && separatorRef.current) {
      initPreviewRefs({
        editor: instance,
        separator: separatorRef.current,
      });
    }

    initPreviewInfos({
      currentProjectId: projectId,
      defaultFileTree: fileTree,
      title: title,
    });

    initPreviewFunctions({
      openCustomPrompt,
      openCustomConfirm,
    });
  };

  const openCustomPrompt = (title, callback) => {
    setModalConfig({ title, callback });
    setInputValue('');
    setIsModalOpen(true);
  };

  const openCustomConfirm = (title, message) => {
    return new Promise((resolve) => {
      setConfirmModalConfig({
        title,
        message,
        resolve,
      });

      setIsConfirmModalOpen(true);
    });
  };

  const handleModalConfirm = () => {
    if (inputValue.trim() && modalConfig.callback) {
      modalConfig.callback(inputValue);
    }
    setIsModalOpen(false);
  };

  const handleConfirm = () => {
    if (confirmModalConfig.resolve) {
      confirmModalConfig.resolve(true);
    }

    setIsConfirmModalOpen(false);
  };

  const handleCancelConfirm = () => {
    if (confirmModalConfig.resolve) {
      confirmModalConfig.resolve(false);
    }

    setIsConfirmModalOpen(false);
  };

  const getInitialContent = () => {
    const findMainNode = (node) => {
      if (node.type === 'file' && node.isMain) return node;

      if (node.children) {
        for (const child of Object.values(node.children)) {
          const found = findMainNode(child);
          if (found) return found;
        }
      }

      return null;
    };

    const findFirstFileNode = (node) => {
      if (node.type === 'file') return node;

      if (node.children) {
        for (const child of Object.values(node.children)) {
          const found = findFirstFileNode(child);
          if (found) return found;
        }
      }

      return null;
    };

    const mainNode =
      findMainNode(fileTree) || fileTree?.children?.['main.typ'] || findFirstFileNode(fileTree);

    let rawData = mainNode?.data || mainNode?.content || '';

    if (rawData.startsWith('data:')) {
      try {
        const base64 = rawData.split(',')[1];
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);

        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }

        return new TextDecoder().decode(bytes);
      } catch (e) {
        console.error('Error:', e);
        return rawData;
      }
    }

    return rawData;
  };

  useEffect(() => {
    const onDragOver = (e) => {
      const isFile = e.dataTransfer.types.includes('Files');

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
      const isFile = e.dataTransfer.types.includes('Files');

      if (isFile) {
        e.preventDefault();
        setIsDraggingGlobal(false);

        if (!canEdit) return;

        const droppedFiles = e.dataTransfer.files;

        if (droppedFiles.length > 0 && refs.imageFilesInput) {
          const dataTransfer = new DataTransfer();

          Array.from(droppedFiles).forEach((file) => {
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

    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);

    import('../../hooks/useEditor').then((mod) => {
      mod.setOnPathChange((newPath) => {
        setActivePath('root/' + newPath);
      });
    });

    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [canEdit]);

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

      <EditorHeader title={title} tags={tags} />

      {!canEdit && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-700 text-xs font-medium text-center py-1.5">
          Read-only mode: you have view access only. To edit, please request edit access from the
          project owner.
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex flex-1 min-w-0 bg-white">
          <Toolbar
            fontSize={editorFontSize}
            onFontSizeChange={handleFontSizeChange}
            wordWrap={wordWrap}
            onWordWrapChange={handleWordWrapChange}
            canEdit={canEdit}
          />

          <div className="flex-1 relative min-w-0 overflow-hidden">
            <Breadcrumbs path={activePath} />

            <FileExplorer canEdit={canEdit} />

            <MonacoEditor
              content={getInitialContent()}
              fontSize={editorFontSize}
              wordWrap={wordWrap}
              readOnly={!canEdit}
              onChange={(newContent) => {
                if (!isLoadingFile && canEdit) {
                  updateContent(newContent);
                }
              }}
              onCursorChange={updateCursor}
              onInstanceReady={handleEditorReady}
            />
          </div>
        </div>

        <div
          ref={separatorRef}
          className="w-1.5 bg-slate-100 hover:bg-blue-200 cursor-col-resize shrink-0 border-x border-slate-200"
        />

        <PreviewPane />
      </div>

      <PaneLog />

      <PromptModal
        isOpen={isModalOpen}
        title={modalConfig.title}
        value={inputValue}
        onChange={setInputValue}
        onConfirm={handleModalConfirm}
        onClose={() => setIsModalOpen(false)}
      />

        {isConfirmModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-5">
                <h2 className="text-lg font-semibold text-slate-900">
                  {confirmModalConfig.title}
                </h2>

                <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">
                  {confirmModalConfig.message}
                </p>
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCancelConfirm}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
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
