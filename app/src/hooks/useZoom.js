import { useEffect, useState } from 'react';
import { refs } from "./refs";

export let zoom = 1;
const zoomStep = 0.1;

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

function updateZoom(page, zoomLevelDisplay) {
    if (page && zoomLevelDisplay) {
        page.style.transform = `scale(${zoom})`;
        page.style.transformOrigin = 'top center';
        zoomLevelDisplay.innerText = `${Math.round(zoom * 100)}%`;
    }
}
