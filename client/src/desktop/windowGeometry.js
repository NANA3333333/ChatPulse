import { DESKTOP_TASKBAR_HEIGHT } from './desktopUtils';

export const DESKTOP_FOLDER_WINDOW_MIN_WIDTH = 640;

export const DESKTOP_FOLDER_WINDOW_MIN_HEIGHT = 420;

export function getDefaultFolderWindowGeometry(index = 0) {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 780;
    const width = Math.min(1180, Math.max(DESKTOP_FOLDER_WINDOW_MIN_WIDTH, Math.round(viewportWidth * 0.76)));
    const height = Math.min(720, Math.max(DESKTOP_FOLDER_WINDOW_MIN_HEIGHT, Math.round(viewportHeight * 0.7)));
    const offset = Math.min(96, Math.max(0, index) * 28);
    return clampFolderWindowGeometry({
        x: 48 + offset,
        y: 28 + offset,
        width,
        height,
    });
}

export function clampFolderWindowGeometry(geometry = {}) {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 780;
    const maxWidth = Math.max(DESKTOP_FOLDER_WINDOW_MIN_WIDTH, viewportWidth - 28);
    const maxHeight = Math.max(DESKTOP_FOLDER_WINDOW_MIN_HEIGHT, viewportHeight - DESKTOP_TASKBAR_HEIGHT - 24);
    const width = Math.min(
        maxWidth,
        Math.max(
            DESKTOP_FOLDER_WINDOW_MIN_WIDTH,
            Math.round(Number(geometry.width) || DESKTOP_FOLDER_WINDOW_MIN_WIDTH),
        ),
    );
    const height = Math.min(
        maxHeight,
        Math.max(
            DESKTOP_FOLDER_WINDOW_MIN_HEIGHT,
            Math.round(Number(geometry.height) || DESKTOP_FOLDER_WINDOW_MIN_HEIGHT),
        ),
    );
    const x = Math.min(Math.max(12, Math.round(Number(geometry.x) || 12)), Math.max(12, viewportWidth - width - 12));
    const y = Math.min(
        Math.max(8, Math.round(Number(geometry.y) || 8)),
        Math.max(8, viewportHeight - DESKTOP_TASKBAR_HEIGHT - height - 8),
    );
    return { x, y, width, height };
}

export function resizeFolderWindowGeometry(startGeometry, deltaX, deltaY, direction = 'se') {
    const start = clampFolderWindowGeometry(startGeometry);
    const dir = String(direction || 'se');
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;
    if (dir.includes('e')) right += deltaX;
    if (dir.includes('w')) left += deltaX;
    if (dir.includes('s')) bottom += deltaY;
    if (dir.includes('n')) top += deltaY;
    if (right - left < DESKTOP_FOLDER_WINDOW_MIN_WIDTH) {
        if (dir.includes('w')) left = right - DESKTOP_FOLDER_WINDOW_MIN_WIDTH;
        else right = left + DESKTOP_FOLDER_WINDOW_MIN_WIDTH;
    }
    if (bottom - top < DESKTOP_FOLDER_WINDOW_MIN_HEIGHT) {
        if (dir.includes('n')) top = bottom - DESKTOP_FOLDER_WINDOW_MIN_HEIGHT;
        else bottom = top + DESKTOP_FOLDER_WINDOW_MIN_HEIGHT;
    }
    return clampFolderWindowGeometry({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    });
}

export const DESKTOP_TEXT_WINDOW_MIN_WIDTH = 520;

export const DESKTOP_TEXT_WINDOW_MIN_HEIGHT = 360;

export function getDefaultTextDocumentWindowGeometry() {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 780;
    const width = Math.min(980, Math.max(DESKTOP_TEXT_WINDOW_MIN_WIDTH, Math.round(viewportWidth * 0.58)));
    const height = Math.min(680, Math.max(DESKTOP_TEXT_WINDOW_MIN_HEIGHT, Math.round(viewportHeight * 0.62)));
    return {
        x: Math.max(18, Math.round((viewportWidth - width) / 2)),
        y: 72,
        width,
        height,
    };
}

export function clampTextDocumentWindowGeometry(geometry) {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 780;
    const maxWidth = Math.max(DESKTOP_TEXT_WINDOW_MIN_WIDTH, viewportWidth - 28);
    const maxHeight = Math.max(DESKTOP_TEXT_WINDOW_MIN_HEIGHT, viewportHeight - DESKTOP_TASKBAR_HEIGHT - 24);
    const width = Math.min(
        maxWidth,
        Math.max(DESKTOP_TEXT_WINDOW_MIN_WIDTH, Math.round(Number(geometry.width) || DESKTOP_TEXT_WINDOW_MIN_WIDTH)),
    );
    const height = Math.min(
        maxHeight,
        Math.max(DESKTOP_TEXT_WINDOW_MIN_HEIGHT, Math.round(Number(geometry.height) || DESKTOP_TEXT_WINDOW_MIN_HEIGHT)),
    );
    const x = Math.min(Math.max(12, Math.round(Number(geometry.x) || 12)), Math.max(12, viewportWidth - width - 12));
    const y = Math.min(
        Math.max(10, Math.round(Number(geometry.y) || 10)),
        Math.max(10, viewportHeight - DESKTOP_TASKBAR_HEIGHT - height - 10),
    );
    return { x, y, width, height };
}

export function resizeTextDocumentWindowGeometry(startGeometry, deltaX, deltaY, direction = 'se') {
    const start = clampTextDocumentWindowGeometry(startGeometry);
    const dir = String(direction || 'se');
    let left = start.x;
    let top = start.y;
    let right = start.x + start.width;
    let bottom = start.y + start.height;
    if (dir.includes('e')) right += deltaX;
    if (dir.includes('w')) left += deltaX;
    if (dir.includes('s')) bottom += deltaY;
    if (dir.includes('n')) top += deltaY;
    if (right - left < DESKTOP_TEXT_WINDOW_MIN_WIDTH) {
        if (dir.includes('w')) left = right - DESKTOP_TEXT_WINDOW_MIN_WIDTH;
        else right = left + DESKTOP_TEXT_WINDOW_MIN_WIDTH;
    }
    if (bottom - top < DESKTOP_TEXT_WINDOW_MIN_HEIGHT) {
        if (dir.includes('n')) top = bottom - DESKTOP_TEXT_WINDOW_MIN_HEIGHT;
        else bottom = top + DESKTOP_TEXT_WINDOW_MIN_HEIGHT;
    }
    return clampTextDocumentWindowGeometry({
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    });
}
