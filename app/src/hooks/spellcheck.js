import Typo from 'typo-js';

const OWNER = 'spellcheck'; // marker owner, also used to filter our code actions
const WORD_RE = /\p{L}+/gu;
const SUPPORTED = new Set(['fr', 'en', 'de']);

// Named arguments in Typst code whose string value is real prose
const TEXT_KEYS = new Set([
  'title',
  'subtitle',
  'caption',
  'body',
  'description',
  'alt',
  'supplement',
  'semester',
  'course-name',
  'cover-image-caption',
]);

// Typst keywords whose expression runs until the end of the line
const LINE_KW = new Set([
  'let',
  'set',
  'show',
  'import',
  'include',
  'if',
  'else',
  'for',
  'while',
  'context',
  'return',
  'break',
  'continue',
]);

// Sticky regexes (/y): they only match at `lastIndex`
const URL_RE = /https?:\/\/[^\s\])>"]+/y;
const REF_RE = /@[\p{L}\d_:-]+(?:\.[\p{L}\d_:-]+)*/uy;
const LABEL_RE = /<[\p{L}\d_:.-]+>/uy;
const IDENT_RE = /[\p{L}_][\p{L}\d_-]*/uy;

const dictCache = {};

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  const text = await r.text();
  // A SPA fallback may return index.html instead of a 404
  if (text.trimStart().startsWith('<')) {
    throw new Error(`${url} : du HTML a été reçu au lieu d'un dictionnaire`);
  }
  return text;
}

function loadDict(lang) {
  if (!dictCache[lang]) {
    const base = `/dictionaries/${lang}/index`;
    dictCache[lang] = Promise.all([fetchText(`${base}.aff`), fetchText(`${base}.dic`)])
      .then(([aff, dic]) => new Typo(lang, aff, dic))
      .catch((err) => {
        delete dictCache[lang]; // don't cache a failure
        throw err;
      });
  }
  return dictCache[lang];
}

// Read the document language from `doc_language = "xx"` or `#set text(lang: "xx")`
function detectLang(text) {
  const m =
    /doc_language\s*=\s*"([a-z]{2})"/.exec(text) ||
    /#set\s+text\([^)]*?lang:\s*"([a-z]{2})"/.exec(text);
  return m ? m[1] : null;
}

// Heuristic scanner (not a real Typst parser).
// Returns [start, end[ ranges of prose to spell-check, skipping comments,
// code, math, raw blocks, URLs, @refs and <labels>.
function findProse(src) {
  const n = src.length;
  const ranges = [];

  // Match a sticky regex exactly at position i
  const at = (re, i) => {
    re.lastIndex = i;
    const m = re.exec(src);
    return m ? m[0] : null;
  };

  const skipLineComment = (i) => {
    const e = src.indexOf('\n', i);
    return e === -1 ? n : e;
  };

  // Typst block comments can be nested
  const skipBlockComment = (i) => {
    let depth = 0;
    while (i < n) {
      if (src.startsWith('/*', i)) {
        depth++;
        i += 2;
      } else if (src.startsWith('*/', i)) {
        depth--;
        i += 2;
        if (!depth) return i;
      } else i++;
    }
    return n;
  };

  // Raw blocks close with the same number of backticks they opened with
  const skipRaw = (i) => {
    let k = i;
    while (src[k] === '`') k++;
    const ticks = k - i;
    if (ticks === 2) return k; // empty raw: ``
    const e = src.indexOf('`'.repeat(ticks), k);
    return e === -1 ? n : e + ticks;
  };

  const skipMath = (i) => {
    let j = i + 1;
    while (j < n && src[j] !== '$') {
      if (src[j] === '\\') j++; // skip escaped char
      j++;
    }
    return Math.min(j + 1, n);
  };

  // Returns the index of the closing quote
  const skipString = (i) => {
    let j = i + 1;
    while (j < n && src[j] !== '"') {
      if (src[j] === '\\') j++;
      j++;
    }
    return j;
  };

  // Code mode: runs until `close` ('\n' means end of line)
  function code(i, close) {
    while (i < n) {
      const c = src[i];

      if (close === '\n' && (c === '\n' || c === ']')) return i;
      if (c === close) return i + 1;

      if (c === '"') {
        const e = skipString(i);
        // Only check strings that follow a known text key, e.g. `caption: "..."`
        const key = /([\w-]+)\s*:\s*$/.exec(src.slice(Math.max(0, i - 40), i));
        if (key && TEXT_KEYS.has(key[1])) ranges.push([i + 1, e]);
        i = e + 1;
      } else if (c === '/' && src[i + 1] === '/') i = skipLineComment(i);
      else if (c === '/' && src[i + 1] === '*') i = skipBlockComment(i);
      else if (c === '`') i = skipRaw(i);
      else if (c === '$') i = skipMath(i);
      else if (c === '[')
        i = markup(i + 1, true); // content block -> back to prose
      else if (c === '(') i = code(i + 1, ')');
      else if (c === '{') i = code(i + 1, '}');
      else i++;
    }
    return n;
  }

  // What can follow a call: (args), [content], .field
  function postfix(i) {
    for (;;) {
      const c = src[i];
      if (c === '(') i = code(i + 1, ')');
      else if (c === '[') i = markup(i + 1, true);
      else if (c === '.') {
        const id = at(IDENT_RE, i + 1);
        if (!id) return i;
        i += 1 + id.length;
      } else return i;
    }
  }

  // Called right after a '#'
  function codeExpr(i) {
    const c = src[i];
    if (c === '(') return code(i + 1, ')');
    if (c === '{') return code(i + 1, '}');
    const id = at(IDENT_RE, i);
    if (!id) return i;
    i += id.length;
    if (LINE_KW.has(id)) return code(i, '\n');
    return postfix(i);
  }

  // Markup mode: collects prose runs; stops at the closing ']' if inBlock
  function markup(i, inBlock) {
    let depth = 0; // nested [ ] inside the block
    let runStart = i;
    const flush = (end) => {
      if (end > runStart) ranges.push([runStart, end]);
    };
    // Close the current run at `from` and restart after the skipped part at `to`
    const jump = (from, to) => {
      flush(from);
      runStart = to;
      return to;
    };

    while (i < n) {
      const c = src[i];

      if (c === '\\') {
        i = jump(i, i + 2);
        continue;
      } // escape sequence

      if (inBlock && c === ']') {
        if (depth === 0) {
          flush(i);
          return i + 1;
        }
        depth--;
        i++;
        continue;
      }
      if (inBlock && c === '[') {
        depth++;
        i++;
        continue;
      }

      // URLs must be tested before '//' so they aren't read as comments
      if (c === 'h') {
        const u = at(URL_RE, i);
        if (u) {
          i = jump(i, i + u.length);
          continue;
        }
      }
      if (c === '/' && src[i + 1] === '/') {
        i = jump(i, skipLineComment(i));
        continue;
      }
      if (c === '/' && src[i + 1] === '*') {
        i = jump(i, skipBlockComment(i));
        continue;
      }
      if (c === '`') {
        i = jump(i, skipRaw(i));
        continue;
      }
      if (c === '$') {
        i = jump(i, skipMath(i));
        continue;
      }
      if (c === '#') {
        flush(i);
        i = codeExpr(i + 1);
        runStart = i;
        continue;
      }
      if (c === '@') {
        const r = at(REF_RE, i);
        if (r) {
          i = jump(i, i + r.length);
          continue;
        }
      }
      if (c === '<') {
        const l = at(LABEL_RE, i);
        if (l) {
          i = jump(i, i + l.length);
          continue;
        }
      }
      i++;
    }
    flush(n);
    return n;
  }

  markup(0, false);
  return ranges;
}

export function initSpellcheck(monaco, editor, initialLang = 'fr', { onLanguageDetected } = {}) {
  let typo = null;
  let timer = null;
  let token = 0; // incremented on each language change to drop stale loads
  let currentLang = initialLang;

  // Words the user chose to ignore, persisted across sessions
  const ignored = new Set(JSON.parse(localStorage.getItem('spell-ignored') || '[]'));
  const persist = () => localStorage.setItem('spell-ignored', JSON.stringify([...ignored]));

  const clearMarkers = () => {
    const model = editor.getModel();
    if (model) monaco.editor.setModelMarkers(model, OWNER, []);
  };

  function check() {
    const model = editor.getModel();
    if (!model) return;

    const text = model.getValue();

    // The document is the source of truth: follow its language if it changes
    const detected = detectLang(text);
    if (detected && detected !== currentLang && SUPPORTED.has(detected)) {
      onLanguageDetected?.(detected);
      setLanguage(detected); // re-runs check() once the dictionary is loaded
      return;
    }

    if (!typo) return; // dictionary not loaded yet

    const markers = [];
    for (const [start, end] of findProse(text)) {
      for (const w of text.slice(start, end).matchAll(WORD_RE)) {
        const word = w[0];
        if (word.length < 3) continue;
        if (word === word.toUpperCase()) continue; // acronyms: USB, ISC, HEI...
        if (ignored.has(word.toLowerCase())) continue;
        if (typo.check(word)) continue;

        const a = model.getPositionAt(start + w.index);
        const b = model.getPositionAt(start + w.index + word.length);
        markers.push({
          severity: monaco.MarkerSeverity.Error,
          message: `Spelling mistake : « ${word} »`,
          source: OWNER,
          startLineNumber: a.lineNumber,
          startColumn: a.column,
          endLineNumber: b.lineNumber,
          endColumn: b.column,
        });
      }
    }
    monaco.editor.setModelMarkers(model, OWNER, markers);
  }

  // Debounce: wait for the user to pause typing
  const schedule = () => {
    clearTimeout(timer);
    timer = setTimeout(check, 300);
  };

  // "Ignore" command, triggered from the quick fix menu
  const ignoreCmd = editor.addCommand(0, (_ctx, word) => {
    ignored.add(word.toLowerCase());
    persist();
    check();
  });

  // Quick fixes: suggestions + "Ignore"
  const provider = monaco.languages.registerCodeActionProvider('*', {
    provideCodeActions(model, _range, context) {
      const actions = [];
      // Only handle our own markers
      for (const marker of context.markers.filter((m) => m.source === OWNER)) {
        const range = new monaco.Range(
          marker.startLineNumber,
          marker.startColumn,
          marker.endLineNumber,
          marker.endColumn,
        );
        const word = model.getValueInRange(range);

        (typo?.suggest(word, 5) || []).forEach((sugg, i) => {
          actions.push({
            title: sugg,
            kind: 'quickfix',
            diagnostics: [marker],
            isPreferred: i === 0,
            edit: {
              edits: [
                {
                  resource: model.uri,
                  versionId: model.getVersionId(),
                  textEdit: { range, text: sugg },
                },
              ],
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

  async function setLanguage(lang) {
    const my = ++token;
    currentLang = lang;
    typo = null;
    clearMarkers();
    try {
      const t = await loadDict(lang);
      if (my !== token) return; // another language change happened meanwhile
      typo = t;
      check();
    } catch (err) {
      console.error(`[spellcheck] dictionnaire "${lang}" indisponible :`, err);
    }
  }

  setLanguage(initialLang);

  return {
    setLanguage,
    dispose() {
      clearTimeout(timer);
      provider.dispose();
      contentListener.dispose();
      clearMarkers();
    },
  };
}
