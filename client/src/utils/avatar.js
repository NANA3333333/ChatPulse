const DEFAULT_AVATAR_STYLE = 'shapes';
const DEFAULT_AVATAR_VERSION = '7.x';
const DEFAULT_AVATAR_BACKGROUNDS = 'e8f0ff,fff5d6,e9f7ef,f5eafa,f1f5f9';

export const defaultAvatarUrl = (seed = 'User') => {
    const safeSeed = encodeURIComponent(String(seed || 'User').trim() || 'User');
    return `https://api.dicebear.com/${DEFAULT_AVATAR_VERSION}/${DEFAULT_AVATAR_STYLE}/svg?seed=${safeSeed}&backgroundColor=${DEFAULT_AVATAR_BACKGROUNDS}`;
};

function getWindowOrigin() {
    return typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost';
}

function getCleanApiUrl(apiUrl) {
    return String(apiUrl || '').trim().replace(/\/api\/?$/, '');
}

function getApiOrigin(cleanApiUrl) {
    try {
        return new URL(cleanApiUrl || '/', getWindowOrigin()).origin;
    } catch {
        return getWindowOrigin();
    }
}

function parseAvatarUrl(raw) {
    try {
        return new URL(raw, getWindowOrigin());
    } catch {
        return null;
    }
}

function isLocalUploadUrl(raw, parsedUrl, apiOrigin) {
    if (!parsedUrl) return false;
    if (raw.startsWith('/')) return true;
    return parsedUrl.origin === apiOrigin || parsedUrl.origin === getWindowOrigin();
}

export const resolveAvatarUrl = (url, apiUrl, fallbackSeed = '') => {
    const raw = String(url || '').trim();
    if (!raw) return fallbackSeed ? defaultAvatarUrl(fallbackSeed) : '';
    const cleanApiUrl = getCleanApiUrl(apiUrl);
    const parsedUrl = parseAvatarUrl(raw);
    const apiOrigin = getApiOrigin(cleanApiUrl);
    const shouldCoerceUpload = isLocalUploadUrl(raw, parsedUrl, apiOrigin);
    const pathPart = parsedUrl?.pathname || '';

    if (shouldCoerceUpload && pathPart.startsWith('/api/media/uploads/')) {
        return cleanApiUrl + pathPart;
    }

    // Coerce scoped user-upload paths into the authenticated media endpoint.
    if (shouldCoerceUpload && pathPart.startsWith('/uploads/users/')) {
        const filename = pathPart.split('/').filter(Boolean).pop();
        if (filename) return `${cleanApiUrl}/api/media/uploads/${filename}`;
    }

    // Coerce legacy public uploaded paths (e.g. http://...:8001/uploads/foo.png) into relative.
    if (shouldCoerceUpload && pathPart.startsWith('/uploads/')) {
        return cleanApiUrl + pathPart;
    }

    return raw;
};
