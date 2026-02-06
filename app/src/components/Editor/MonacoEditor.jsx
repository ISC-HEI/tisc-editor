import { useRef, useEffect } from "react";
import * as monaco from "monaco-editor";
import { typstSyntax, typstConfig } from "../../assets/typst-definition";

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

      editor.onDidChangeModelContent(() => {
        if (!isRemoteChange.current && onChange) {
          const value = editor.getValue();
          onChange(value);
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

  useEffect(() => {
    const editor = monacoInstance.current;
    if (editor) {
      const model = editor.getModel();
      const currentValue = editor.getValue();

      if (model && content !== currentValue) {
        isRemoteChange.current = true;
        
        editor.executeEdits("remote-update", [
          {
            range: model.getFullModelRange(),
            text: content || "",
            forceMoveMarkers: true,
          },
        ]);

        isRemoteChange.current = false;
      }
    }
  }, [content]);

  return <div ref={editorRef} className="h-full w-full" />;
};