import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { refs } from '@/hooks/refs';

const NEXT_KEYS = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'];
const PREV_KEYS = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];
const CONTROLS_HIDE_DELAY_MS = 2000;

/**
 * Reads the pages of the current preview SVG: their position (set by
 * applyPageGaps as `translate(0, y)`) and size, in pt.
 */
function readPages(svg) {
  return Array.from(svg.querySelectorAll('g.typst-page')).map((page) => {
    const match = (page.getAttribute('transform') || '').match(
      /translate\(\s*[-\d.eE]+[\s,]+([-\d.eE]+)/,
    );
    return {
      y: match ? parseFloat(match[1]) : 0,
      width: parseFloat(page.getAttribute('data-page-width')) || 0,
      height: parseFloat(page.getAttribute('data-page-height')) || 0,
    };
  });
}

/**
 * Clones the rendered preview SVG so it can be shown one page at a time
 * (through its viewBox) without touching the editor's preview.
 */
function clonePreviewSvg() {
  const source = refs.page?.querySelector('svg');
  if (!source) return null;

  const svg = source.cloneNode(true);
  svg.querySelectorAll('.tisc-comment-pin').forEach((pin) => pin.remove());
  svg.removeAttribute('width');
  svg.removeAttribute('height');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.display = 'block';

  return { svg, pages: readPages(svg) };
}

/**
 * Fullscreen slideshow of the compiled document: one page per screen,
 * navigated with the keyboard, clicks or the on-screen controls.
 * Follows recompilations so edits made elsewhere show up live.
 */
export function PresentationMode({ startPage = 0, onClose }) {
  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const svgRef = useRef(null);
  const hideTimerRef = useRef(null);

  const [pages, setPages] = useState([]);
  const [current, setCurrent] = useState(startPage);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  const pageCount = pages.length;

  const goTo = useCallback(
    (index) => setCurrent(Math.min(Math.max(index, 0), Math.max(pageCount - 1, 0))),
    [pageCount],
  );
  const next = useCallback(() => setCurrent((i) => Math.min(i + 1, pageCount - 1)), [pageCount]);
  const prev = useCallback(() => setCurrent((i) => Math.max(i - 1, 0)), []);

  // (Re)build the slide from the preview, initially and after each recompilation.
  useEffect(() => {
    const render = () => {
      const result = clonePreviewSvg();
      if (!result || !stageRef.current) return;
      stageRef.current.replaceChildren(result.svg);
      svgRef.current = result.svg;
      setPages(result.pages);
      setCurrent((i) => Math.min(i, Math.max(result.pages.length - 1, 0)));
    };

    // Cloning a large document blocks the main thread: wait two frames so the
    // loader is painted first, then hide it once the slide itself is painted.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        render();
        frame = requestAnimationFrame(() => setIsLoading(false));
      });
    });

    window.addEventListener('tisc:preview-rendered', render);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('tisc:preview-rendered', render);
    };
  }, []);

  // Show only the current page by framing it with the viewBox.
  useEffect(() => {
    const page = pages[current];
    const svg = svgRef.current;
    if (svg && page) {
      svg.setAttribute('viewBox', `0 ${page.y} ${page.width} ${page.height}`);
      // Don't make the browser paint the pages that are off screen anyway.
      svg.querySelectorAll('g.typst-page').forEach((group, index) => {
        group.style.display = index === current ? '' : 'none';
      });
    }
  }, [pages, current]);

  // Enter fullscreen on mount; leaving it (Esc, F11...) closes the presentation.
  useEffect(() => {
    const root = rootRef.current;
    root?.requestFullscreen?.().catch(() => {
      // Fullscreen refused (e.g. iframe policy): the overlay still covers the window.
    });

    const onFullscreenChange = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (NEXT_KEYS.includes(e.key)) next();
      else if (PREV_KEYS.includes(e.key)) prev();
      else if (e.key === 'Home') goTo(0);
      else if (e.key === 'End') goTo(pageCount - 1);
      else if (e.key === 'Escape') onClose();
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [next, prev, goTo, pageCount, onClose]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
  }, []);

  // Controls start visible, then fade out until the mouse moves.
  useEffect(() => {
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
    return () => clearTimeout(hideTimerRef.current);
  }, []);

  const handleStageClick = (e) => {
    // Internal links (outline, @refs) jump to their target page.
    const link = e.target.closest?.('a[data-typst-page]');
    if (link) {
      e.preventDefault();
      goTo(Number(link.dataset.typstPage) - 1);
      return;
    }
    if (e.target.closest?.('a[href]')) return;

    const rect = rootRef.current.getBoundingClientRect();
    if (e.clientX - rect.left < rect.width / 3) prev();
    else next();
  };

  const controlButton =
    'p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors';

  return createPortal(
    <div
      ref={rootRef}
      data-test="presentation-mode"
      onMouseMove={revealControls}
      onContextMenu={(e) => {
        e.preventDefault();
        prev();
      }}
      className={`fixed inset-0 z-[200] bg-black select-none ${controlsVisible ? '' : 'cursor-none'}`}
    >
      <div ref={stageRef} onClick={handleStageClick} className="absolute inset-0" />

      {isLoading && (
        <div
          role="status"
          data-test="presentation-loader"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black text-white/70 text-sm"
        >
          <span className="relative flex h-8 w-8">
            <span className="absolute inset-0 rounded-full border-2 border-white/20"></span>
            <span className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
          </span>
          Preparing presentation…
        </div>
      )}

      {!isLoading && pageCount === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-white/60 text-sm">
          Nothing to present yet: the document has not been compiled.
        </div>
      )}

      <div
        className={`absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/70 backdrop-blur px-3 py-1.5 shadow-2xl transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <button
          type="button"
          onClick={prev}
          disabled={current === 0}
          title="Previous page (←)"
          className={controlButton}
        >
          <ChevronLeft size={18} />
        </button>
        <span
          data-test="presentation-page-counter"
          className="text-xs font-semibold text-white/80 tabular-nums min-w-[56px] text-center"
        >
          {pageCount ? current + 1 : 0} / {pageCount}
        </span>
        <button
          type="button"
          onClick={next}
          disabled={current >= pageCount - 1}
          title="Next page (→)"
          className={controlButton}
        >
          <ChevronRight size={18} />
        </button>
        <div className="w-px h-5 bg-white/20 mx-1" />
        <button
          type="button"
          onClick={onClose}
          title="Exit presentation (Esc)"
          className={controlButton}
        >
          <X size={18} />
        </button>
      </div>
    </div>,
    document.body,
  );
}
