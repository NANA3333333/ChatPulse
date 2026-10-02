/**
 * Relationships DLC — Social Graph & Inter-Character Impressions
 * Extracted from server/index.js
 */
const { scheduleInitialImpressions, regenerateImpression } = require("./impressionService.js");

const MAX_IMPRESSION_HISTORY_LIMIT = 200;

function hasQueryValue(value) {
    return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalizeImpressionHistoryLimit(value, fallback = 50) {
    if (!hasQueryValue(value)) return fallback;
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_IMPRESSION_HISTORY_LIMIT) return null;
    return parsed;
}

module.exports = function initRelationships(app, context) {
    const { authMiddleware, getUserDb, callLLM } = context;

    // 13. Friendships
    require("./http/get-characters-id-friends.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getUserDb() { return getUserDb; } });

    require("./http/post-characters-id-friends.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get callLLM() { return callLLM; }, get getUserDb() { return getUserDb; }, get scheduleInitialImpressions() { return scheduleInitialImpressions; } });

    // 13.5 Get character relationships (inter-char affinity)
    require("./http/get-characters-id-relationships.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getUserDb() { return getUserDb; } });

    // 13.5.5 Get character impression history
    require("./http/get-characters-id-impressions-targetId.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get getUserDb() { return getUserDb; }, get normalizeImpressionHistoryLimit() { return normalizeImpressionHistoryLimit; } });

    // 13.6 Regenerate impression for a specific relationship pair
    require("./http/post-characters-id-relationships-regenerate.js").register({ get app() { return app; }, get authMiddleware() { return authMiddleware; }, get callLLM() { return callLLM; }, get getUserDb() { return getUserDb; }, get regenerateImpression() { return regenerateImpression; } });

    console.log('[Relationships DLC] Relationship matching routes registered.');
};
