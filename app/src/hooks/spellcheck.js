const OWNER = 'spellcheck';

export function initSpellcheck(monaco, editor, initialLang = 'fr', { onLanguageDetected } = {}) {
  const worker = new Worker(new URL('./spellcheck.worker.js', import.meta.url), { type: 'module' });

  let timer = null;
  let latestRequestId = 0;       // ignore stale 'result' messages
  let nextSuggestId = 0;
  const pendingSuggestions = new Map(); // requestId -> { resolve, reject }

  const ignored = new Set(JSON.parse(localStorage.getItem('spell-ignored') || '[]'));
  const persist = () => localStorage.setItem('spell-ignored', JSON.stringify([...ignored]));

  const clearMarkers = () => {
    const model = editor.getModel();
    if (model) monaco.editor.setModelMarkers(model, OWNER, []);
  };

  // Ask the worker to scan the current text. The worker replies
  // asynchronously with a 'result' message, handled below.
  function check() {
    const model = editor.getModel();
    if (!model) return;

    const requestId = ++latestRequestId;
    worker.postMessage({ type: 'check', text: model.getValue(), requestId });
  }

  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(check, 300); // debounce
  };

  worker.onmessage = (e) => {
    const msg = e.data;

    switch (msg.type) {
      case 'result': {
        if (msg.requestId !== latestRequestId) return; // a newer check superseded this one
        const model = editor.getModel();
        if (!model) return;

        // Convert the worker's raw offsets into Monaco positions here,
        // on the main thread, since the worker has no access to the model.
        const markers = msg.words.map(({ start, end, word }) => {
          const a = model.getPositionAt(start);
          const b = model.getPositionAt(end);
          return {
            severity: monaco.MarkerSeverity.Error,
            message: `Spelling mistake : « ${word} »`,
            source: OWNER,
            startLineNumber: a.lineNumber,
            startColumn: a.column,
            endLineNumber: b.lineNumber,
            endColumn: b.column,
          };
        });
        monaco.editor.setModelMarkers(model, OWNER, markers);
        break;
      }

      case 'languageDetected':
        onLanguageDetected?.(msg.lang);
        worker.postMessage({ type: 'setLanguage', lang: msg.lang });
        break;

      case 'dictionaryReady':
        clearMarkers();
        check(); // re-run the check that triggered the language switch (or the initial one)
        break;

      case 'dictionaryError':
        console.error(`[spellcheck] dictionary "${msg.lang}" unavailable:`, msg.message);
        break;

      case 'suggestions': {
        const pending = pendingSuggestions.get(msg.requestId);
        if (pending) {
          pendingSuggestions.delete(msg.requestId);
          pending.resolve(msg.suggestions);
        }
        break;
      }
    }
  };

  function suggest(word) {
    const requestId = ++nextSuggestId;
    return new Promise((resolve, reject) => {
      pendingSuggestions.set(requestId, { resolve, reject });
      worker.postMessage({ type: 'suggest', word, requestId });
    });
  }

  // "Ignore" command
  const ignoreCmd = editor.addCommand(0, (_ctx, word) => {
    ignored.add(word.toLowerCase());
    persist();
    worker.postMessage({ type: 'ignore', word });
    check();
  });

  // Quick fixes — now async since suggestions come from the worker
  const provider = monaco.languages.registerCodeActionProvider('*', {
    async provideCodeActions(model, _range, context) {
      const actions = [];

      for (const marker of context.markers.filter((m) => m.source === OWNER)) {
        const range = new monaco.Range(
          marker.startLineNumber, marker.startColumn,
          marker.endLineNumber, marker.endColumn
        );
        const word = model.getValueInRange(range);
        const suggestions = await suggest(word);

        suggestions.forEach((sugg, i) => {
          actions.push({
            title: sugg,
            kind: 'quickfix',
            diagnostics: [marker],
            isPreferred: i === 0,
            edit: {
              edits: [{
                resource: model.uri,
                versionId: model.getVersionId(),
                textEdit: { range, text: sugg },
              }],
            },
          });
        });

        actions.push({
          title: `Ignore « ${word} »`,
          kind: 'quickfix',
          diagnostics: [marker],
          command: { id: ignoreCmd, title: 'Ignore', arguments: [word] },
        });
      }
      return { actions, dispose() {} };
    },
  });

  const contentListener = editor.onDidChangeModelContent(schedule);

  worker.postMessage({ type: 'init', lang: initialLang, ignored: [...ignored], origin: window.location.origin, });

  return {
    setLanguage(lang) {
      worker.postMessage({ type: 'setLanguage', lang });
    },
    dispose() {
      clearTimeout(timer);
      provider.dispose();
      contentListener.dispose();
      clearMarkers();
      // Reject any suggestion request still waiting on a terminated worker
      for (const { reject } of pendingSuggestions.values()) reject(new Error('disposed'));
      pendingSuggestions.clear();
      worker.terminate();
    },
  };
}
