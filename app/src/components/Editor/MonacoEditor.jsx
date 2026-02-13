import { useRef, useEffect } from "react";
import * as monaco from "monaco-editor";
import { typstSyntax, typstConfig } from "../../assets/typst-definition";
import { refs } from "@/hooks/refs";
import { currentFilePath } from "@/hooks/useEditor";

export const MonacoEditor = ({ content, onChange, onInstanceReady }) => {
  const editorRef = useRef(null);
  const monacoInstance = useRef(null);
  const isRemoteChange = useRef(false);

  useEffect(() => {
    if (editorRef.current && !monacoInstance.current) {
      const langId = "typst";
      const isRegistered = monaco.languages.getLanguages().some(l => l.id === langId);
      
      if (!isRegistered) {
        monaco.languages.register({ id: langId });
        monaco.languages.setLanguageConfiguration(langId, typstConfig);
        monaco.languages.setMonarchTokensProvider(langId, typstSyntax);
      }

      const editor = monaco.editor.create(editorRef.current, {
        value: content || "",
        language: langId,
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

      monacoInstance.current = editor;
      refs.monaco = monaco;

      editor.onDidChangeModelContent((event) => {
        if (!isRemoteChange.current && onChange) {
          onChange({
            filename: currentFilePath,
            changes: event.changes 
          });
        }
      });

      if (onInstanceReady) {
        onInstanceReady(editor);
      }
    }

    return () => {
      if (monacoInstance.current) {
        monacoInstance.current.dispose();
        monacoInstance.current = null;
      }
    };
  }, []);

  return <div ref={editorRef} className="h-full w-full" />;
}