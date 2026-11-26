/**
 * Typst language support for Monaco.
 *
 * Syntax highlighting uses the TextMate grammar of clysto/typst-vscode
 * (vendored in ./typst-grammar), run through Shiki's TextMate engine with its
 * JavaScript regex engine (no WebAssembly to serve).
 */

export const TYPST_LANGUAGE_ID = 'typst';
export const TYPST_THEME = 'light-plus';

/**
 * Editor configuration for Typst (from clysto/typst-vscode's
 * language-configuration.json): comments, brackets, auto-closing and
 * surrounding pairs.
 */
export const typstConfig = {
  comments: { lineComment: '//', blockComment: ['/*', '*/'] },
  brackets: [
    ['[', ']'],
    ['{', '}'],
    ['(', ')'],
  ],
  autoClosingPairs: [
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: '"', close: '"', notIn: ['string'] },
    { open: '$', close: '$', notIn: ['string'] },
  ],
  autoCloseBefore: ';:.,=}])>$ \n\t',
  surroundingPairs: [
    { open: '[', close: ']' },
    { open: '{', close: '}' },
    { open: '(', close: ')' },
    { open: '"', close: '"' },
    { open: '*', close: '*' },
    { open: '_', close: '_' },
    { open: '`', close: '`' },
    { open: '$', close: '$' },
  ],
};

let highlightingSetup = null;

/**
 * Registers the Typst language and its TextMate highlighting in Monaco.
 * Runs once; later calls return the same promise. The grammars (~380 KB) and
 * Shiki are loaded lazily so they don't weigh on the editor's first paint.
 */
export function setupTypstLanguage(monaco) {
  if (highlightingSetup) return highlightingSetup;

  if (!monaco.languages.getLanguages().some((l) => l.id === TYPST_LANGUAGE_ID)) {
    monaco.languages.register({ id: TYPST_LANGUAGE_ID });
  }
  monaco.languages.setLanguageConfiguration(TYPST_LANGUAGE_ID, typstConfig);

  highlightingSetup = (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, { shikiToMonaco }] =
      await Promise.all([
        import('@shikijs/core'),
        import('@shikijs/engine-javascript'),
        import('@shikijs/monaco'),
      ]);

    const [typst, typstCode] = await Promise.all([
      import('./typst-grammar/typst.tmLanguage.json').then((m) => m.default),
      import('./typst-grammar/typst-code.tmLanguage.json').then((m) => m.default),
    ]);

    const highlighter = await createHighlighterCore({
      themes: [import('@shikijs/themes/light-plus')],
      langs: [
        // Raw blocks embed ~45 other languages: they are not loaded and stay plain text.
        { ...typstCode, name: 'typst-code', embeddedLangsLazy: [] },
        { ...typst, name: TYPST_LANGUAGE_ID, embeddedLangsLazy: [] },
      ],
      engine: createJavaScriptRegexEngine(),
    });

    shikiToMonaco(highlighter, monaco);
    monaco.editor.setTheme(TYPST_THEME);
  })().catch((err) => {
    console.error('Typst syntax highlighting failed to load:', err);
    highlightingSetup = null;
  });

  return highlightingSetup;
}
