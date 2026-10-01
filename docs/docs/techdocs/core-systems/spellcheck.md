# Spellcheck

The editor includes a built-in spellchecker for Typst documents. It runs **entirely in the browser**: no text is sent to a server, and no API route is involved. Misspelled words are underlined in red in the Monaco editor, and a quick fix menu offers suggestions.

It is built on [`typo-js`](https://github.com/cfinke/Typo.js) (a Hunspell-compatible checker) and Monaco's marker and code action APIs. All the expensive work — loading dictionaries, scanning the document, computing suggestions — runs inside a **Web Worker**, so typing in a large document never blocks the UI thread.

## Overview

| Aspect | Details |
| --- | --- |
| Defined in | `spellcheck.js` (exposes `initSpellcheck`, runs on the main thread), `spellcheck.worker.js` (does the actual checking, runs in a Web Worker) |
| Supported languages | `fr`, `en`, `de` |
| Dictionaries | Hunspell files served from `/dictionaries/<lang>/index.aff` and `index.dic` |
| Runs on | Client only. The document scan and dictionary lookups run in a Web Worker; only marker/position conversion and UI happen on the main thread |
| Trigger | 300 ms after the last edit (debounced) |
| Persistence | Ignored words are stored in `localStorage` (`spell-ignored`), on the main thread |

## How it works

`initSpellcheck` spawns a dedicated `Worker` (`spellcheck.worker.js`) and communicates with it over `postMessage`. Nothing CPU-heavy runs on the main thread.

Each check follows the same steps:

1. **Schedule.** 300 ms after the user stops typing, `spellcheck.js` sends the current text to the worker as a `check` message, tagged with a `requestId`.
2. **Detect the language** *(in the worker)*. The text is scanned for its declared language (see [Language handling](#language-handling)). If it differs from the current one, the worker reports it back instead of checking, and waits for the new dictionary.
3. **Extract the prose** *(in the worker)*. `findProse()` scans the Typst source and returns the ranges that contain real text (see [What is checked](#what-is-checked)).
4. **Check each word** *(in the worker)*. Every word in those ranges is tested against the dictionary. Words that are too short, in capitals, or ignored by the user are skipped. The worker replies with a plain list of `{ start, end, word }` offsets — it has no access to Monaco.
5. **Publish the markers** *(back on the main thread)*. `spellcheck.js` converts each offset to a line/column with `model.getPositionAt` and calls `setModelMarkers`, which draws the red underline and fills the Problems list. A reply is discarded if a newer `check` request was sent in the meantime, so a slow check never overwrites a fresher one.

## What is checked

Spellchecking a Typst file is not the same as checking plain text: most of the file is code. The scanner walks the source and switches between **markup mode** (prose) and **code mode**.

| Checked | Ignored |
| --- | --- |
| Paragraphs, headings, lists | Comments (`//` and `/* */`, including nested ones) |
| Footnotes and any content block `[...]`, including inside calls such as `#figure(..., caption: [...])` or `#todo[...]` | Code: `#let`, `#set`, `#show`, `#import`, `#include`, `#if`, `#for`, etc. |
| Strings passed to a [known text argument](#text-arguments) | Other strings (`lang: "fr"`, `"@preview/..."`, `style: "ieee"`, ...) |
| | Math (`$...$`) |
| | Raw text and code blocks (`` ` `` and `` ``` ``) |
| | URLs, `@references` and `<labels>` |
| | Escape sequences (`\#`, `\$`, ...) |

### Text arguments

Some function arguments take a plain string that is real prose. Those strings are checked, but only when they follow one of these argument names:

`title`, `subtitle`, `caption`, `body`, `description`, `alt`, `supplement`, `semester`, `course-name`, `cover-image-caption`

For example, `caption: "Un tout petit listing en Scala"` is checked, while `style: "ieee"` is not. To check the strings of another argument used by a template, add its name to the `TEXT_KEYS` set.

### Skipped words

Inside the prose, a word is not checked if:

- it has **fewer than 3 letters**;
- it is **entirely uppercase** (acronyms such as `USB`, `ISC`, `HEI`);
- it was added to the **ignore list** by the user.

Words are split on anything that is not a letter, so `l'homme` is checked as `l` and `homme`, and `well-known` as `well` and `known`.

## Language handling

The **document is the source of truth** for the language. On every check, the worker searches the source for, in order:

1. `doc_language = "xx"`
2. `#set text(lang: "xx")`

If the detected code is supported (`fr`, `en`, `de`) and differs from the current language, the worker sends a `languageDetected` message instead of a result. On the main thread, `spellcheck.js`:

1. calls the `onLanguageDetected(lang)` callback, if provided;
2. tells the worker to load the new dictionary (`setLanguage`);
3. once the worker confirms the dictionary is ready (`dictionaryReady`), clears the current markers and runs a new check.

This means the language menu in the toolbar does not need to talk to the spellchecker directly: when it rewrites the language in the document (`applyLanguageToTypst`), the next check picks up the change.

:::info[Unsupported languages]

If the document declares a language that is not in `SUPPORTED` (for example `it`), the change is ignored and the previous dictionary stays active.

:::

If no language is found in the document, the language passed to `initSpellcheck` (`fr` by default) is used.

## Quick fixes

Placing the cursor on an underlined word and opening the quick fix menu (`Ctrl+.` / `Cmd+.`, or the lightbulb) shows:

- up to **5 suggestions** from the dictionary. The first one is marked as preferred; selecting one replaces the word.
- **Ignore "word"**, which adds the word to the ignore list.

Suggestions are computed by `typo.suggest()` **inside the worker**, so `provideCodeActions` awaits a `suggest` round-trip (`spellcheck.js` → worker → `spellcheck.js`) before returning the actions. Monaco supports an async `CodeActionProvider`, so this adds a small delay but never blocks typing.

### Ignored words

Ignored words are stored lowercase in `localStorage` under the `spell-ignored` key, as a JSON array, on the **main thread** (workers have no access to `localStorage`). The list is:

- **global to the browser**: it applies to all projects and all languages;
- **not synchronized** between devices or users;
- not editable from the UI. To reset it, clear the `spell-ignored` key in the browser's storage.

It is sent to the worker once at startup (`init` message) and kept up to date with `ignore` messages whenever a word is added, so the filtering itself happens where the check loop runs.

## API

### `initSpellcheck(monaco, editor, initialLang?, options?)`

Attaches the spellchecker to a Monaco editor instance. It spawns a `Worker` (`spellcheck.worker.js`), registers a content listener and a code action provider, then asks the worker to load the initial dictionary.

| Parameter | Type | Description |
| --- | --- | --- |
| `monaco` | `Monaco` | The Monaco namespace |
| `editor` | `IStandaloneCodeEditor` | The editor instance to check |
| `initialLang` | `string` | Language used until the document declares one. Defaults to `'fr'` |
| `options.onLanguageDetected` | `(lang: string) => void` | Called when the document's language differs from the current one, so the UI (e.g. the toolbar badge) can stay in sync |

**Returns** an object with:

| Member | Description |
| --- | --- |
| `setLanguage(lang)` | Tells the worker to load the dictionary for `lang` and re-checks the document once it's ready. Concurrent calls are safe: only the most recent one is applied |
| `dispose()` | Cancels the pending check, unregisters the listener and code action provider, clears the markers, rejects any pending suggestion request, and **terminates the worker** |

```js
const spellcheck = initSpellcheck(monaco, editor, 'fr', {
  onLanguageDetected: (lang) => setActiveLang(lang),
});

// When the editor is destroyed
spellcheck.dispose();
```

:::warning[Call `dispose()`]

`initSpellcheck` registers a global code action provider and spawns a `Worker`. Not calling `dispose()` when the editor unmounts leaves the code action provider registered (duplicated on the next mount) **and** leaks the worker, which keeps running and holding its dictionary in memory.

:::

:::info[One worker per editor]

Each call to `initSpellcheck` creates its own worker, so each open editor loads and holds its own copy of the dictionary in memory. This keeps the implementation simple, at the cost of some duplicated memory when many editors are open at once (e.g. several tabs). If that becomes a problem, a `SharedWorker` could be used instead, but this is not currently implemented.

:::

## Dictionaries

Dictionaries are Hunspell files loaded with `fetch` **inside the worker**, from the `public` folder:

```
public/dictionaries/
├── fr/
│   ├── index.aff
│   └── index.dic
├── en/
│   ├── index.aff
│   └── index.dic
└── de/
    ├── index.aff
    └── index.dic
```

- Both files are fetched in parallel the first time a language is needed, then the `Typo` instance is **cached** in the worker for the rest of the session.
- The worker has no reliable `location` of its own (it may be loaded from a bundler-generated `blob:` URL), so it cannot resolve `/dictionaries/<lang>/index.aff` as a relative path. `spellcheck.js` sends `window.location.origin` to the worker in the `init` message, and the worker builds an **absolute URL** (`${origin}/dictionaries/<lang>/index.aff`) before fetching. Fetching a bare relative path from the worker fails with `TypeError: ... is not a valid URL`.
- Loading is validated: an HTTP error, or an HTML page returned in place of a dictionary (a common SPA fallback on a missing file), is treated as a failure. A failed load is **not cached**, so it is retried on the next language change.
- While a dictionary is loading, or if it fails to load, no markers are shown.

### Adding a language

1. Add the Hunspell files under `public/dictionaries/<code>/index.aff` and `index.dic`.
2. Add the code to the `SUPPORTED` set in `spellcheck.js`.
3. Add it to the `LANGUAGES` list of the toolbar, so users can select it.

## Limitations

- **Heuristic scanner, not a Typst parser.** It handles the usual constructs well, but unusual syntax (for example text following a `#if ... [...]` on the same line) can cause some words to be missed. It is designed to miss a word rather than to flag valid code.
- **No grammar checking.** Only individual words are verified.
- **Proper names and technical terms** that are not in the dictionary (`Keycloak`, `Typst`, names of authors) are flagged. Use *Ignore* to add them.
- **Full re-scan on each check.** The whole document is analyzed after every pause in typing. Since this runs off the main thread, it no longer blocks typing or scrolling, but a very large file can still take noticeably longer to get its markers updated.
- **One dictionary per editor instance.** Each editor spawns its own worker and loads its own copy of the dictionary; see the note under [`initSpellcheck`](#initspellcheckmonaco-editor-initiallang-options).
- **Read-only users see the markers too.** The spellchecker does not depend on the [user's role](./roles-permissions), it only underlines. Quick fixes can be applied only if the editor is writable.
