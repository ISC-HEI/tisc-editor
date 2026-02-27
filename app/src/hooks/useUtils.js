import { showToast } from "nextjs-toast-notify";
import { infos } from "./refs";

/**
 * Creates a debounced version of a function that delays execution until after 
 * a specified wait time has elapsed since the last time it was invoked.
 * @param {Function} func - The function to debounce.
 * @param {number} [delay=1000] - The delay in milliseconds.
 * @returns {Function} A new debounced function.
 */
export function debounce(func, delay = 1000) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

/**
 * Triggers a browser download for a given Blob object.
 * Creates a temporary URL and an invisible anchor element to initiate the download.
 * @param {Blob} blob - The data to download.
 * @param {string} filename - The name to give the downloaded file.
 */
export function downloadBlob(blob, filename) {
    if (!blob || !filename) return;

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
}

/**
 * Generates a timestamp string based on the current date and time.
 * Format: YYYYMMDD_HHMMSS (e.g., 20240520_143005).
 * @returns {string} The formatted timestamp.
 */
export function formatDateNow() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_` +
        `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/**
 * Displays a notification toast on the screen using nextjs-toast-notify.
 * Supports different styles and icons based on the notification type.
 * @param {string} text - The message to display in the toast.
 * @param {'success'|'error'|'info'|'warning'} type - The visual style and severity level.
 */
export function makeToast(text, type) {
    let toastParams = {
        duration: 4000,
        position: "top-right",
        transition: "fadeIn",
        progress: true
    }
    let infoIcon = '<svg viewBox="-1.92 -1.92 27.84 27.84" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 17V11" stroke="#ffffff" stroke-width="0.768" stroke-linecap="round"></path> <circle cx="1" cy="1" r="1" transform="matrix(1 0 0 -1 11 9)" fill="#ffffff"></circle> <path d="M7 3.33782C8.47087 2.48697 10.1786 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 10.1786 2.48697 8.47087 3.33782 7" stroke="#ffffff" stroke-width="0.768" stroke-linecap="round"></path> </g></svg>'
    switch (type) {
        case "success":
            showToast.success(text, toastParams);
            break;
        case "error":
            showToast.error(text, toastParams);
            break;
        case "info":
            toastParams["icon"] = infoIcon
            showToast.info(text, toastParams);
            break;
        case "warning":
            toastParams["icon"] = infoIcon
            showToast.warning(text, toastParams);
            break;
    }
}

/**
 * Generates a consistent HSL color palette based on a string (e.g., an email).
 * Useful for assigning unique but stable colors to different users.
 * @param {string} str - The input string to hash.
 * @returns {Object} An object containing 'base' (light), 'dark' (medium), and 'darker' (text) HSL strings.
 */
export function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    
    return {
        base: `hsl(${h}, 70%, 90%)`,
        dark: `hsl(${h}, 70%, 45%)`,
        darker: `hsl(${h}, 80%, 25%)`
    };
};

/**
 * Dispatches a custom event to update the PaneLog component with a new log entry.
 * @param {Object} log - The log object.
 * @param {string} log.type - 'info', 'success', 'warning', or 'error'.
 * @param {string} log.msg - The message to display.
 * @param {string} [log.time] - Optional timestamp.
 */
export function addLogToPane(log) {
    const timeWithMs = log.time || new Date().toLocaleTimeString() + '.' + new Date().getMilliseconds().toString().padStart(3, '0');

    const isDuplicate = infos.logs.some(existingLog => existingLog.time === timeWithMs);

    if (!isDuplicate) {
        infos.logs.push({
            ...log,
            id: crypto.randomUUID(),
            time: timeWithMs
        });
    }
}