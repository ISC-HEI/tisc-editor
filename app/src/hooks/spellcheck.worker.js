import Typo from 'typo-js';

const SUPPORTED = new Set(['fr', 'en', 'de']);

const WORD_RE = /\p{L}+/gu;

let origin = '';

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

const URL_RE = /https?:\/\/[^\s\])>"]+/y;
const REF_RE = /@[\p{L}\d_:-]+(?:\.[\p{L}\d_:-]+)*/uy;
const LABEL_RE = /<[\p{L}\d_:.-]+>/uy;
const IDENT_RE = /[\p{L}_][\p{L}\d_-]*/uy;

// ─────────────────────────────────────────────────────────────
// Dictionaries — unchanged from the main-thread version, just
// moved here. fetch() and Typo both work fine inside a worker.
// ─────────────────────────────────────────────────────────────
const dictCache = {};

function dictUrl(lang, ext) {
  return `${origin}/dictionaries/${lang}/index.${ext}`;
}

async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  const text = await r.text();
  if (text.trimStart().startsWith('<')) {
    throw new Error(`${url}: received HTML instead of a dictionary`);
  }
  return text;
}

function loadDict(lang) {
  if (!dictCache[lang]) {
    dictCache[lang] = Promise.all([
      fetchText(dictUrl(lang, 'aff')),
      fetchText(dictUrl(lang, 'dic')),
    ])
      .then(([aff, dic]) => new Typo(lang, aff, dic))
      .catch((err) => {
        delete dictCache[lang];
        throw err;
      });
  }
  return dictCache[lang];
}

function detectLang(text) {
  const m =
    /doc_language\s*=\s*"([a-z]{2})"/.exec(text) ||
    /#set\s+text\([^)]*?lang:\s*"([a-z]{2})"/.exec(text);
  return m ? m[1] : null;
}

// ─────────────────────────────────────────────────────────────
// findProse — identical logic to the main-thread version, moved
// here unchanged. It's the expensive part, so it belongs in the
// worker.
// ─────────────────────────────────────────────────────────────
function findProse(src) {
  const n = src.length;
  const ranges = [];

  const at = (re, i) => {
    re.lastIndex = i;
    const m = re.exec(src);
    return m ? m[0] : null;
  };

  const skipLineComment = (i) => {
    const e = src.indexOf('\n', i);
    return e === -1 ? n : e;
  };

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

  const skipRaw = (i) => {
    let k = i;
    while (src[k] === '`') k++;
    const ticks = k - i;
    if (ticks === 2) return k;
    const e = src.indexOf('`'.repeat(ticks), k);
    return e === -1 ? n : e + ticks;
  };

  const skipMath = (i) => {
    let j = i + 1;
    while (j < n && src[j] !== '$') {
      if (src[j] === '\\') j++;
      j++;
    }
    return Math.min(j + 1, n);
  };

  const skipString = (i) => {
    let j = i + 1;
    while (j < n && src[j] !== '"') {
      if (src[j] === '\\') j++;
      j++;
    }
    return j;
  };

  function code(i, close) {
    while (i < n) {
      const c = src[i];

      if (close === '\n' && (c === '\n' || c === ']')) return i;
      if (c === close) return i + 1;

      if (c === '"') {
        const e = skipString(i);
        const key = /([\w-]+)\s*:\s*$/.exec(src.slice(Math.max(0, i - 40), i));
        if (key && TEXT_KEYS.has(key[1])) ranges.push([i + 1, e]);
        i = e + 1;
      } else if (c === '/' && src[i + 1] === '/') i = skipLineComment(i);
      else if (c === '/' && src[i + 1] === '*') i = skipBlockComment(i);
      else if (c === '`') i = skipRaw(i);
      else if (c === '$') i = skipMath(i);
      else if (c === '[') i = markup(i + 1, true);
      else if (c === '(') i = code(i + 1, ')');
      else if (c === '{') i = code(i + 1, '}');
      else i++;
    }
    return n;
  }

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

  function markup(i, inBlock) {
    let depth = 0;
    let runStart = i;
    const flush = (end) => {
      if (end > runStart) ranges.push([runStart, end]);
    };
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
      }

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

// ─────────────────────────────────────────────────────────────
// Worker state
// ─────────────────────────────────────────────────────────────
let typo = null;
let currentLang = null;
let langToken = 0; // bumped on each setLanguage() call, to drop stale loads
let ignored = new Set();

async function setLanguage(lang) {
  const my = ++langToken;
  currentLang = lang;
  typo = null;
  try {
    const t = await loadDict(lang);
    if (my !== langToken) return; // a newer setLanguage call superseded this one
    typo = t;
    postMessage({ type: 'dictionaryReady', lang });
  } catch (err) {
    postMessage({ type: 'dictionaryError', lang, message: String(err) });
  }
}

// Scans `text`, returns misspelled words as raw offsets (no Monaco here)
function doCheck(text, requestId) {
  if (!typo) {
    postMessage({ type: 'result', requestId, words: [] });
    return;
  }

  const words = [];
  for (const [start, end] of findProse(text)) {
    for (const w of text.slice(start, end).matchAll(WORD_RE)) {
      const word = w[0];
      if (word.length < 3) continue;
      if (word === word.toUpperCase()) continue; // acronyms
      if (ignored.has(word.toLowerCase())) continue;
      if (typo.check(word)) continue;

      words.push({ start: start + w.index, end: start + w.index + word.length, word });
    }
  }
  postMessage({ type: 'result', requestId, words });
}

onmessage = (e) => {
  const msg = e.data;

  switch (msg.type) {
    case 'init':
      origin = msg.origin;
      ignored = new Set(msg.ignored);
      setLanguage(msg.lang);
      break;

    case 'setLanguage':
      setLanguage(msg.lang);
      break;

    case 'check': {
      // The document is the source of truth for the language: the main
      // thread doesn't need to pre-detect it, this worker does it too.
      const detected = detectLang(msg.text);
      if (detected && SUPPORTED.has(detected) && detected !== currentLang) {
        postMessage({ type: 'languageDetected', lang: detected });
        // no result for this request: the main thread will re-send
        // a 'check' once the new dictionary is ready
        break;
      }
      doCheck(msg.text, msg.requestId);
      break;
    }

    case 'ignore':
      ignored.add(msg.word.toLowerCase());
      break;

    case 'suggest':
      postMessage({
        type: 'suggestions',
        requestId: msg.requestId,
        suggestions: typo?.suggest(msg.word, 5) || [],
      });
      break;
  }
};
