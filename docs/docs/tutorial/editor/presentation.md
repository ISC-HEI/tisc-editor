# Presentation

The TISC Editor can show your document fullscreen, one page at a time, like a slideshow. It works with any document, and is especially handy for slides made with a Typst presentation package (e.g. [Touying](https://typst.app/universe/package/touying) or [Polylux](https://typst.app/universe/package/polylux)).

## Start a presentation

Click **Present** in the preview toolbar. The document opens fullscreen on a black background, starting at the first page. Each page is scaled to fill the screen.

The presentation uses the document as it is currently rendered in the preview: nothing is compiled again, and comment pins are not shown.

## Navigate between pages

| Action | Keyboard | Mouse |
| --- | --- | --- |
| Next page | **→**, **↓**, **Space**, **Enter**, **Page Down** | Click on the right two thirds of the screen |
| Previous page | **←**, **↑**, **Backspace**, **Page Up** | Click on the left third of the screen, or right-click |
| First / last page | **Home** / **End** | — |
| Exit | **Esc** | **✕** button |

Presentation remotes (clickers) usually send **Page Up** / **Page Down**, so they work out of the box.

A control bar at the bottom of the screen shows the current page (e.g. `3 / 12`) with previous / next / exit buttons. It hides, together with the mouse cursor, after 2 seconds without moving the mouse.

Internal links of the document (table of contents, `@references`) jump to the page they point to.

## Live updates

If the document is recompiled during the presentation (e.g. a collaborator edits it), the slides are updated right away, staying on the current page.
