import { useRef, useEffect } from "react";
import * as monaco from "monaco-editor";

export const MonacoEditor = ({ content, onInstanceReady }) => {
  const editorRef = useRef(null);
  const monacoInstance = useRef(null);

  useEffect(() => {
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