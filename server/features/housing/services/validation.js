// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function compactText(value, fallback = '') {
    return String(value || '').replace(/\s+/g, ' ').trim() || fallback;
}

function sendSocialHousingError(res, error) {
    const status = dependencies.isSocialHousingValidationError(error) ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
}

function looksLikePriceText(text) {
    const value = String(text || '');
    return /\d/.test(value) && /(周租|售价|买断价|元|金币|租)/.test(value);
}

function maskSecretLast4(value) {
    const text = String(value || '').trim();
    return text ? text.slice(-4) : '';
}

function redactSocialHousingCharacterSecrets(characters = []) {
    return (Array.isArray(characters) ? characters : []).map((char) => {
        const apiKey = String(char?.api_key || '').trim();
        return {
            ...char,
            api_key: '',
            api_key_configured: !!apiKey,
            api_key_last4: maskSecretLast4(apiKey)
        };
    });
}

function clampNumber(value, min, max) {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.max(min, Math.min(max, num));
}

    return { compactText, sendSocialHousingError, looksLikePriceText, maskSecretLast4, redactSocialHousingCharacterSecrets, clampNumber };
}

module.exports = { createModule };
