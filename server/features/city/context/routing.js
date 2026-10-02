// Feature-owned operations; dependencies are supplied by the composition root.
function createModule(dependencies) {
function buildRecentCityRouteContext(db, character, maxItems = 5) {
    if (!db || !character?.id) return '';
    try {
        if (!db.city) {
            try {
                const initCityDb = require("../cityDb.js");
                db.city = initCityDb(typeof db.getRawDb === 'function' ? db.getRawDb() : db);
            } catch (e) { /* ignore */ }
        }
        if (!db.city || typeof db.city.getCharacterRecentLogs !== 'function') return '';
        const rows = db.city.getCharacterRecentLogs(character.id, Math.max(1, maxItems)) || [];
        if (!Array.isArray(rows) || rows.length === 0) return '';
        const lines = rows.slice(0, maxItems).map((row, index) => {
            const location = String(row?.location || '').trim();
            const actionType = String(row?.action_type || '').trim();
            const message = String(row?.message || '').trim();
            const parts = [`${index + 1}. ${message}`];
            if (location) parts.push(`地点=${location}`);
            if (actionType) parts.push(`类型=${actionType}`);
            return parts.join(' | ');
        }).filter(Boolean);
        if (lines.length === 0) return '';
        return ['[最近商业街记录]', ...lines].join('\n');
    } catch (e) {
        console.warn('[ContextBuilder] Failed to build recent city route context:', e.message);
        return '';
    }
}

    return { buildRecentCityRouteContext };
}

module.exports = { createModule };
