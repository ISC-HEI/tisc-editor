import { useEffect } from 'react';
import { refs } from './refs';

/** @type {number} The current scale factor (1 = 100%). */
export let zoom = 1;

/** @constant {number} The amount to increase or decrease the zoom per click. */
const zoomStep = 0.1;
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 3;

/**
 * Clamps and applies a new zoom value.
 * @param {number} value
 */
function setZoom(value) {
  zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 100) / 100));
  updateZoom(refs.page, refs.zoomLevelDisplay);
}

/**
 * Binds the zoom buttons and Ctrl/Cmd + wheel to the preview.
 * @returns {(() => void) | null} A cleanup function, or null if the DOM elements aren't ready yet.
 */
function initZoom() {
  const { btnZoomIn, btnZoomOut, page, zoomLevelDisplay, previewContainer } = refs;
  if (!btnZoomIn || !btnZoomOut || !page || !zoomLevelDisplay || !previewContainer) {
    return null;
  }

  updateZoom(page, zoomLevelDisplay);

  btnZoomIn.onclick = () => setZoom(zoom + ZOOM_STEP);
  btnZoomOut.onclick = () => setZoom(zoom - ZOOM_STEP);

  const handleWheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setZoom(zoom + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  };

  previewContainer.addEventListener('wheel', handleWheel, { passive: false });

  return () => {
    btnZoomIn.onclick = null;
    btnZoomOut.onclick = null;
    previewContainer.removeEventListener('wheel', handleWheel);
  };
}

/**
 * React hook that waits for the zoom control references, then binds them.
 * Retries every 100ms until the elements are present in the DOM.
 */
export function useZoomWatcher() {
  useEffect(() => {
    let cleanup = initZoom();
    let interval;

    if (!cleanup) {
      interval = setInterval(() => {
        cleanup = initZoom();
        if (cleanup) clearInterval(interval);
      }, 100);
    }

    return () => {
      clearInterval(interval);
      cleanup?.();
    };
  }, []);
}

// ----------------------------------------

/**
 * Applies the current zoom level to the preview element using CSS transforms
 * and updates the percentage text in the UI.
 * @param {HTMLElement} page - The preview container to scale.
 * @param {HTMLElement} zoomLevelDisplay - The text element showing the zoom percentage.
 */
function updateZoom(page, zoomLevelDisplay) {
  if (page && zoomLevelDisplay) {
    page.style.transform = `scale(${zoom})`;
    page.style.transformOrigin = 'top center';
    zoomLevelDisplay.innerText = `${Math.round(zoom * 100)}%`;
  }
}
