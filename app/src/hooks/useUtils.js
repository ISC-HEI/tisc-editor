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
    let toastParams = {
        duration: 4000,
        position: "top-right",
        transition: "fadeIn",
        progress: true
    }
    let infoIcon = '<svg viewBox="-1.92 -1.92 27.84 27.84" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path d="M12 17V11" stroke="#ffffff" stroke-width="0.768" stroke-linecap="round"></path> <circle cx="1" cy="1" r="1" transform="matrix(1 0 0 -1 11 9)" fill="#ffffff"></circle> <path d="M7 3.33782C8.47087 2.48697 10.1786 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 10.1786 2.48697 8.47087 3.33782 7" stroke="#ffffff" stroke-width="0.768" stroke-linecap="round"></path> </g></svg>'
    switch(type) {
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