import { useRef, useEffect } from "react";
import * as monaco from "monaco-editor";
import { typstSyntax, typstConfig } from "../../assets/typst-definition";

export const MonacoEditor = ({ content, onInstanceReady }) => {
  const editorRef = useRef(null);
  const monacoInstance = useRef(null);

  useEffect(() => {
    if (editorRef.current && !monacoInstance.current) {
      
      const langId = "typst";
      const isRegistered = monaco.languages.getLanguages().some(l => l.id === langId);
      
      if (!isRegistered) {
        monaco.languages.register({ id: langId });
        monaco.languages.setLanguageConfiguration(langId, typstConfig);
        monaco.languages.setMonarchTokensProvider(langId, typstSyntax);
      }

      monacoInstance.current = monaco.editor.create(editorRef.current, {
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

      if (onInstanceReady) {
        onInstanceReady(monacoInstance.current);
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
};