import { showToast } from "nextjs-toast-notify";

export function debounce(func, delay = 1000) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

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

export function formatDateNow() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");
    return `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_` +
           `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function makeToast(text, type) {
    const toastParams = {
        duration: 4000,
        position: "top-right",
        transition: "slideIn",
        progress: true
    }
    switch(type) {
        case "success":
            showToast.success(text, toastParams);
            break;
        case "error":
            showToast.error(text, toastParams);
            break;
        case "info":
            showToast.info(text, toastParams);
            break;
        case "warning":
            showToast.warning(text, toastParams);
            break;
    }
}