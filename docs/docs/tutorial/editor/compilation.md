# Code Compilation

The TISC Editor compiles your Typst code on the fly and renders it as **SVG**, giving you a live, accurate preview of your document as you write.

## Live preview

Every change to your code is reflected in the preview panel, so you always see an up-to-date rendering of your document without needing to export it manually.

## Synchronized navigation

The editor and the preview stay synchronized. If you edit content on page 12, the preview automatically follows and displays page 12 — there is no need to manually scroll to find the corresponding page.

## Debounced compilation

To keep the editor responsive, compilation is not triggered on every keystroke. Instead, the editor waits for a short pause in your typing — a technique known as **debouncing** — before recompiling.

This approach avoids unnecessary recompilations while typing and ensures the preview updates shortly after you stop, without introducing noticeable lag.