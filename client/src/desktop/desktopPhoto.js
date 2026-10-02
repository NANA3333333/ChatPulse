export function formatDesktopPhotoTimestamp(value, lang = 'zh') {
    const date = new Date(Number(value) || Date.now());
    return date.toLocaleString(lang === 'en' ? 'en-US' : 'zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export function getDesktopPhotoFileName(photo) {
    const date = new Date(Number(photo?.createdAt) || Date.now());
    const pad = (value) => String(value).padStart(2, '0');
    const stamp = [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        '-',
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
    ].join('');
    return `ChatPulse-Screenshot-${stamp}.${String(photo?.type || '').includes('jpeg') ? 'jpg' : 'png'}`;
}

export function getDesktopStylesheetText() {
    return Array.from(document.styleSheets || [])
        .map((sheet) => {
            try {
                return Array.from(sheet.cssRules || [])
                    .map((rule) => rule.cssText)
                    .join('\n');
            } catch {
                return '';
            }
        })
        .filter(Boolean)
        .join('\n');
}

export function makeDesktopFallbackScreenshot(width, height, lang = 'zh') {
    const safeWidth = Math.max(480, Math.round(Number(width) || 1280));
    const safeHeight = Math.max(320, Math.round(Number(height) || 720));
    const title = lang === 'en' ? 'ChatPulse Screenshot' : 'ChatPulse 桌面截图';
    const time = formatDesktopPhotoTimestamp(Date.now(), lang);
    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">`,
        '<defs>',
        '<linearGradient id="bg" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f5d5e4"/><stop offset="0.55" stop-color="#dce8ff"/><stop offset="1" stop-color="#f8efd8"/></linearGradient>',
        '</defs>',
        '<rect width="100%" height="100%" fill="url(#bg)"/>',
        `<rect x="${Math.round(safeWidth * 0.08)}" y="${Math.round(safeHeight * 0.18)}" width="${Math.round(safeWidth * 0.84)}" height="${Math.round(safeHeight * 0.52)}" rx="28" fill="rgba(255,255,255,0.72)" stroke="rgba(76,91,130,0.18)"/>`,
        `<text x="50%" y="44%" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#2f3d5e">${title}</text>`,
        `<text x="50%" y="53%" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#6b7592">${time}</text>`,
        '</svg>',
    ].join('');
    return {
        dataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
        width: safeWidth,
        height: safeHeight,
        type: 'image/svg+xml',
    };
}

export function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const image = new window.Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.decoding = 'async';
        image.src = src;
    });
}

export async function captureDesktopElement(element, lang = 'zh') {
    if (!element || typeof window === 'undefined' || typeof document === 'undefined') {
        return makeDesktopFallbackScreenshot(1280, 720, lang);
    }
    const rect = element.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width || window.innerWidth || 1280));
    const height = Math.max(1, Math.round(rect.height || window.innerHeight || 720));
    const clone = element.cloneNode(true);
    clone
        .querySelectorAll('.desktop-context-menu, .desktop-app-drag-ghost, .desktop-folder-app-drag-ghost')
        .forEach((node) => node.remove());
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.margin = '0';
    clone.style.position = 'relative';
    clone.style.left = '0';
    clone.style.top = '0';
    const cssText = getDesktopStylesheetText();
    const html = new XMLSerializer().serializeToString(clone);
    const svg = [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
        `<foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml"><style>${cssText}</style>${html}</div></foreignObject>`,
        '</svg>',
    ].join('');
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
        const image = await loadImageElement(svgUrl);
        const maxWidth = 1280;
        const scale = Math.min(1, maxWidth / width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
        return {
            dataUrl,
            width: canvas.width,
            height: canvas.height,
            type: 'image/jpeg',
        };
    } catch (error) {
        console.warn('Desktop screenshot capture fell back to generated image:', error);
        return makeDesktopFallbackScreenshot(width, height, lang);
    } finally {
        URL.revokeObjectURL(svgUrl);
    }
}
