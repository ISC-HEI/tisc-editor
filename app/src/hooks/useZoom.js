import { useEffect, useState } from 'react';
import { refs } from "./refs";

/** @type {number} The current scale factor (1 = 100%). */
export let zoom = 1;

/** @constant {number} The amount to increase or decrease the zoom per click. */
const zoomStep = 0.1;

/**
 * Binds click events to zoom-in and zoom-out buttons.
 * Sets up the initial visual state of the preview page.
 * @returns {boolean} True if all necessary DOM elements were found and initialized.
 */
function initZoom() {
    if (!refs.btnZoomIn || !refs.btnZoomOut || !refs.page || !refs.zoomLevelDisplay) {
        return false;
    }

    updateZoom(refs.page, refs.zoomLevelDisplay);

    refs.btnZoomIn.onclick = () => {
        zoom += zoomStep;
        updateZoom(refs.page, refs.zoomLevelDisplay);
    };

    refs.btnZoomOut.onclick = () => {
        zoom = Math.max(0.1, zoom - zoomStep);
        updateZoom(refs.page, refs.zoomLevelDisplay);
    };

    return true;
}

/**
 * React hook that monitors the availability of zoom control references.
 * Retries initialization if elements are not yet present in the DOM.
 */
export function useZoomWatcher() {
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        const success = initZoom();

        if (!success && !initialized) {
            const interval = setInterval(() => {
                if (initZoom()) {
                    setInitialized(true);
                    clearInterval(interval);
                }
            }, 100);
            return () => clearInterval(interval);
        }

        return () => {
            if (refs.btnZoomIn) refs.btnZoomIn.onclick = null;
            if (refs.btnZoomOut) refs.btnZoomOut.onclick = null;
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
