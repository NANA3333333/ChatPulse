const DEFAULT_AVATAR_STYLE = 'shapes';
const DEFAULT_AVATAR_VERSION = '7.x';
const DEFAULT_AVATAR_BACKGROUNDS = 'e8f0ff,fff5d6,e9f7ef,f5eafa,f1f5f9';

export const defaultAvatarUrl = (seed = 'User') => {
    const safeSeed = encodeURIComponent(String(seed || 'User').trim() || 'User');
    return `https://api.dicebear.com/${DEFAULT_AVATAR_VERSION}/${DEFAULT_AVATAR_STYLE}/svg?seed=${safeSeed}&backgroundColor=${DEFAULT_AVATAR_BACKGROUNDS}`;
};

export const resolveAvatarUrl = (url, apiUrl, fallbackSeed = '') => {
    const raw = String(url || '').trim();
    if (!raw) return fallbackSeed ? defaultAvatarUrl(fallbackSeed) : '';
    const cleanApiUrl = String(apiUrl || '').replace(/\/api$/, '');

    // Coerce any legacy absolute uploaded paths (e.g. http://...:8001/uploads/...) into relative
    if (raw.includes('/uploads/')) {
        const pathPart = raw.substring(raw.indexOf('/uploads/'));
        return cleanApiUrl + pathPart;
    }

    return raw;
};
