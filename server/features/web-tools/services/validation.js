// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function nowIso() {
    return new Date().toISOString();
}

function safeText(value, maxLength = 2000) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function safeSnippet(value) {
    return safeText(value, 4000);
}

function safeParseJson(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value !== 'string') return value || fallback;
    try {
        return JSON.parse(value);
    } catch (e) {
        return fallback;
    }
}

function makeId() {
    return dependencies.crypto.randomUUID ? dependencies.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function ensureMcpLabDb(db) {
    if (!db.mcpLab) {
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : db;
        db.mcpLab = dependencies.initMcpLabDb(rawDb);
    }
    return db.mcpLab;
}

function assertHttpUrl(rawUrl) {
    return dependencies.normalizeMcpHttpUrl(rawUrl);
}

function maskSecret(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (text.length <= 8) return '*'.repeat(text.length);
    return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

    return { nowIso, safeText, safeSnippet, safeParseJson, makeId, ensureMcpLabDb, assertHttpUrl, maskSecret };
}

module.exports = { createModule };
