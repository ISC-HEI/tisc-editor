'use client';
import { useRef, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import { typstSyntax, typstConfig } from '../../assets/typst-definition';
import { refs } from '@/hooks/refs';
import { currentFilePath } from '@/hooks/useEditor';
import { initSpellcheck } from '@/hooks/spellcheck';

// Monaco options behind the "Auto-completion" setting (VS Code-like suggestions)
const autocompleteOptions = (enabled) => ({
  quickSuggestions: enabled,
  suggestOnTriggerCharacters: enabled,
  wordBasedSuggestions: enabled ? 'matchingDocuments' : 'off',
  parameterHints: { enabled },
});

export const MonacoEditor = ({
  content,
  fontSize,
  wordWrap,
  spellcheck = true,
  autocomplete = true,
  onChange,
  onCursorChange,
  onInstanceReady,
  readOnly,
}) => {
  const editorRef = useRef(null);
  const monacoInstance = useRef(null);
  const isRemoteChange = useRef(false);

  useEffect(() => {
    if (!editorRef.current) return;

    const langId = 'typst';
    const isRegistered = monaco.languages.getLanguages().some((l) => l.id === langId);

    if (!isRegistered) {
      monaco.languages.register({ id: langId });
      monaco.languages.setLanguageConfiguration(langId, typstConfig);
      monaco.languages.setMonarchTokensProvider(langId, typstSyntax);
    }

    const editor = monaco.editor.create(editorRef.current, {
      value: content || '',
      language: langId,
      theme: 'vs-light',
      automaticLayout: true,
      fontSize: fontSize || 14,
      wordWrap: wordWrap ? 'on' : 'off',
      fontFamily: "'Fira Code', monospace",
      minimap: { enabled: false },
      lineNumbers: 'on',
      roundedSelection: true,
      scrollBeyondLastLine: false,
      padding: { top: 16 },
      lineNumbersMinChars: 3,
      readOnly,
      ...autocompleteOptions(autocomplete),
    });

    monacoInstance.current = editor;
    refs.monaco = monaco;
    refs.editor = editor;
    refs.spellcheck = initSpellcheck(monaco, editor, 'en', { userEnabled: spellcheck });

    // Gestion des changements de contenu
    editor.onDidChangeModelContent((event) => {
      if (!isRemoteChange.current && onChange) {
        onChange({
          filename: currentFilePath,
          changes: event.changes,
        });
      }
    });

    // Gestion du curseur
    editor.onDidChangeCursorSelection((event) => {
      if (!isRemoteChange.current && onCursorChange) {
        onCursorChange({
          filename: currentFilePath,
          selection: event.selection,
        });
      }
    });

    if (onInstanceReady) {
      onInstanceReady(editor);
    }

    return () => {
      if (editor) {
        editor.dispose();
        monacoInstance.current = null;
        refs.editor = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (monacoInstance.current) {
      monacoInstance.current.updateOptions({ fontSize: fontSize || 14 });
    }
  }, [fontSize]);

  useEffect(() => {
    if (monacoInstance.current) {
      monacoInstance.current.updateOptions({ wordWrap: wordWrap ? 'on' : 'off' });
    }
  }, [wordWrap]);

  useEffect(() => {
    refs.spellcheck?.setUserEnabled(spellcheck);
  }, [spellcheck]);

  useEffect(() => {
    if (monacoInstance.current) {
      monacoInstance.current.updateOptions(autocompleteOptions(autocomplete));
    }
  }, [autocomplete]);

  return <div ref={editorRef} className="h-full w-full" />;
};
