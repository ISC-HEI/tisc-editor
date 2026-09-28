# Spellcheck

The editor includes a built-in spellchecker for Typst documents. It runs **entirely in the browser**: no text is sent to a server, and no API route is involved. Misspelled words are underlined in red in the Monaco editor, and a quick fix menu offers suggestions.

It is built on [`typo-js`](https://github.com/cfinke/Typo.js) (a Hunspell-compatible checker) and Monaco's marker and code action APIs.

## Overview

| Aspect | Details |
| --- | --- |
| Defined in | `spellcheck.js` (exposes `initSpellcheck`) |
| Supported languages | `fr`, `en`, `de` |
| Dictionaries | Hunspell files served from `/dictionaries/<lang>/index.aff` and `index.dic` |
| Runs on | Client only, in the Monaco editor |
| Trigger | 300 ms after the last edit (debounced) |
| Persistence | Ignored words are stored in `localStorage` (`spell-ignored`) |

## How it works

Each check follows the same steps:

1. **Detect the language.** The document text is scanned for its language (see [Language handling](#language-handling)). If it differs from the current one, the dictionary is switched and the check restarts once the new dictionary is loaded.
2. **Extract the prose.** `findProse()` scans the Typst source and returns the ranges that contain real text (see [What is checked](#what-is-checked)).
3. **Check each word.** Every word in those ranges is tested against the dictionary. Words that are too short, in capitals, or ignored by the user are skipped.
4. **Publish the markers.** Misspelled words are sent to Monaco with `setModelMarkers`, which draws the red underline and fills the Problems list.

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

The **document is the source of truth** for the language. On every check, the source is searched for, in order:

1. `doc_language = "xx"`
2. `#set text(lang: "xx")`

If the detected code is supported (`fr`, `en`, `de`) and differs from the current language, the spellchecker:

1. calls the `onLanguageDetected(lang)` callback, if provided;
2. clears the current markers and loads the new dictionary;
3. runs a new check once the dictionary is ready.

This means the language menu in the toolbar does not need to talk to the spellchecker directly: when it rewrites the language in the document (`applyLanguageToTypst`), the next check picks up the change.

:::info[Unsupported languages]

If the document declares a language that is not in `SUPPORTED` (for example `it`), the change is ignored and the previous dictionary stays active.

:::

If no language is found in the document, the language passed to `initSpellcheck` (`fr` by default) is used.

## Quick fixes

Placing the cursor on an underlined word and opening the quick fix menu (`Ctrl+.` / `Cmd+.`, or the lightbulb) shows:

- up to **5 suggestions** from the dictionary. The first one is marked as preferred; selecting one replaces the word.
- **Ignore "word"**, which adds the word to the ignore list.

### Ignored words

Ignored words are stored lowercase in `localStorage` under the `spell-ignored` key, as a JSON array. This list is:

- **global to the browser**: it applies to all projects and all languages;
- **not synchronized** between devices or users;
- not editable from the UI. To reset it, clear the `spell-ignored` key in the browser's storage.

## API

### `initSpellcheck(monaco, editor, initialLang?, options?)`

Attaches the spellchecker to a Monaco editor instance. It registers a content listener and a code action provider, then loads the initial dictionary.

| Parameter | Type | Description |
| --- | --- | --- |
| `monaco` | `Monaco` | The Monaco namespace |
| `editor` | `IStandaloneCodeEditor` | The editor instance to check |
| `initialLang` | `string` | Language used until the document declares one. Defaults to `'fr'` |
| `options.onLanguageDetected` | `(lang: string) => void` | Called when the document's language differs from the current one, so the UI (e.g. the toolbar badge) can stay in sync |

**Returns** an object with:

| Member | Description |
| --- | --- |
| `setLanguage(lang)` | Loads the dictionary for `lang` and re-checks the document. Concurrent calls are safe: only the most recent one is applied |
| `dispose()` | Cancels the pending check, unregisters the listener and code action provider, and clears the markers |

```js
const spellcheck = initSpellcheck(monaco, editor, 'fr', {
  onLanguageDetected: (lang) => setActiveLang(lang),
});

// When the editor is destroyed
spellcheck.dispose();
```

:::warning[Call `dispose()`]

`initSpellcheck` registers a global code action provider. Not calling `dispose()` when the editor unmounts leaves it registered, and it will be duplicated the next time the editor mounts.

:::

## Dictionaries

Dictionaries are Hunspell files loaded with `fetch` from the `public` folder:

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

- Both files are fetched in parallel the first time a language is needed, then the `Typo` instance is **cached** for the rest of the session.
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
- **Full re-scan on each check.** The whole document is analyzed after every pause in typing. This is fast for typical reports, but very large files may show a small delay.
- **Read-only users see the markers too.** The spellchecker does not depend on the [user's role](./role-permissions), it only underlines. Quick fixes can be applied only if the editor is writable.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| **Every word is underlined** | The dictionary files were not loaded correctly (wrong path or a server returning HTML). Check the browser console for a `[spellcheck]` error and confirm that `/dictionaries/<lang>/index.aff` and `.dic` open directly in the browser |
| **Nothing is underlined** | The dictionary is still loading or failed to load (see the console), or the text is inside code, math or a string that is not in `TEXT_KEYS` |
| **Wrong language used** | The document declares another language via `doc_language` or `#set text(lang: ...)`. The document always takes precedence |
| **A valid word keeps being flagged** | Use the *Ignore* quick fix. If it still appears, it might be split by an apostrophe or a hyphen into shorter fragments |
| **A word was ignored by mistake** | Remove the `spell-ignored` key from `localStorage` (this resets the whole list) |
