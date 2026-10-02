// GET /api/user/memory-status
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/user/memory-status', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/user/memory-status"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    try {
        const config = dependencies.qdrant.getQdrantConfig();
        const collectionName = dependencies.qdrant.getCollectionName(req.user.id);
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        const characters = typeof db.getCharacters === 'function' ? db.getCharacters() : [];

        const summaryRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    SUM(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' THEN 1 ELSE 0 END) AS memories_count,
                    COUNT(*) AS legacy_memories_count,
                    SUM(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' AND embedding IS NOT NULL AND length(embedding) > 0 THEN 1 ELSE 0 END) AS embedded_count,
                    SUM(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' AND COALESCE(is_archived, 0) = 1 THEN 1 ELSE 0 END) AS archived_count,
                    SUM(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' THEN 1 ELSE 0 END) AS structured_count,
                    COUNT(DISTINCT CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' THEN character_id END) AS characters_with_memories,
                    SUM(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' AND (COALESCE(last_retrieved_at, 0) > 0 OR COALESCE(retrieval_count, 0) > 0) THEN 1 ELSE 0 END) AS ever_retrieved_count,
                    COALESCE(SUM(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' THEN COALESCE(retrieval_count, 0) ELSE 0 END), 0) AS total_retrievals,
                    MAX(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' THEN COALESCE(updated_at, created_at, 0) ELSE 0 END) AS last_memory_at,
                    MAX(CASE WHEN COALESCE(NULLIF(consolidation_summary, ''), '') <> '' THEN COALESCE(last_retrieved_at, 0) ELSE 0 END) AS last_retrieved_at
                FROM memories
            `).get()
            : null;

        const tokenRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COALESCE(SUM(prompt_tokens + completion_tokens), 0) AS token_total,
                    COUNT(*) AS request_count,
                    MAX(timestamp) AS last_token_at
                FROM token_usage
            `).get()
            : null;

        const cacheSummaryRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    COUNT(DISTINCT CASE WHEN COALESCE(character_id, '') <> '' THEN character_id END) AS cached_characters_count,
                    MAX(last_hit_at) AS last_cache_hit_at,
                    MAX(created_at) AS last_cache_write_at
                FROM llm_cache
                WHERE expires_at > ?
            `).get(Date.now())
            : null;

        const cacheStatsRow = typeof db.getLlmCacheStats === 'function'
            ? db.getLlmCacheStats('global')
            : null;

        const cacheByCharacterRows = rawDb
            ? rawDb.prepare(`
                SELECT
                    COALESCE(character_id, '') AS character_id,
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    MAX(last_hit_at) AS last_hit_at,
                    MAX(created_at) AS last_write_at
                FROM llm_cache
                WHERE expires_at > ?
                  AND COALESCE(character_id, '') <> ''
                GROUP BY character_id
                ORDER BY entries_count DESC, hit_count DESC
                LIMIT 12
            `).all(Date.now())
            : [];

        const promptBlockSummaryRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(COALESCE(hit_count, 0)), 0) AS hit_count,
                    MAX(COALESCE(last_hit_at, 0)) AS last_hit_at,
                    MAX(COALESCE(updated_at, created_at, 0)) AS last_write_at
                FROM prompt_block_cache
            `).get()
            : null;

        const digestSummaryRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COALESCE(SUM(entries_count), 0) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    MAX(last_hit_at) AS last_hit_at,
                    MAX(last_write_at) AS last_write_at
                FROM (
                    SELECT
                        COUNT(*) AS entries_count,
                        COALESCE(SUM(COALESCE(hit_count, 0)), 0) AS hit_count,
                        MAX(COALESCE(last_hit_at, 0)) AS last_hit_at,
                        MAX(COALESCE(updated_at, created_at, 0)) AS last_write_at
                    FROM conversation_digest_cache
                    UNION ALL
                    SELECT
                        COUNT(*) AS entries_count,
                        COALESCE(SUM(COALESCE(hit_count, 0)), 0) AS hit_count,
                        MAX(COALESCE(last_hit_at, 0)) AS last_hit_at,
                        MAX(COALESCE(updated_at, created_at, 0)) AS last_write_at
                    FROM group_conversation_digest_cache
                )
            `).get()
            : null;

        const status = {
            enabled: !!config.enabled,
            reachable: false,
            url: config.url,
            mode: config.enabled
                ? (process.platform === 'win32' && dependencies.fs.existsSync(dependencies.path.join(require('../../../paths').repoRoot, 'tools', 'qdrant', 'current', 'qdrant.exe')) ? 'local' : (/127\.0\.0\.1|localhost/i.test(config.url) ? 'self-hosted' : 'external'))
                : 'disabled',
            backend: config.enabled ? 'qdrant-primary-with-vectra-fallback' : 'vectra-fallback-only',
            collectionName,
            collectionExists: false,
            indexedPoints: 0,
            indexingCoverage: 0,
            indexingSource: config.enabled ? 'qdrant' : 'vectra-fallback',
            charactersCount: characters.length,
            charactersWithMemories: Number(summaryRow?.characters_with_memories || 0),
            memoriesCount: Number(summaryRow?.memories_count || 0),
            legacyMemoriesCount: Number(summaryRow?.legacy_memories_count || 0),
            embeddedMemoriesCount: Number(summaryRow?.embedded_count || 0),
            structuredMemoriesCount: Number(summaryRow?.structured_count || 0),
            archivedMemoriesCount: Number(summaryRow?.archived_count || 0),
            everRetrievedMemoriesCount: Number(summaryRow?.ever_retrieved_count || 0),
            totalRetrievals: Number(summaryRow?.total_retrievals || 0),
            healthyContextCacheEntriesCount: Number(promptBlockSummaryRow?.entries_count || 0) + Number(digestSummaryRow?.entries_count || 0),
            healthyContextCacheHitCount: Number(promptBlockSummaryRow?.hit_count || 0) + Number(digestSummaryRow?.hit_count || 0),
            promptBlockCacheEntriesCount: Number(promptBlockSummaryRow?.entries_count || 0),
            promptBlockCacheHitCount: Number(promptBlockSummaryRow?.hit_count || 0),
            digestCacheEntriesCount: Number(digestSummaryRow?.entries_count || 0),
            digestCacheHitCount: Number(digestSummaryRow?.hit_count || 0),
            healthyContextCacheLastHitAt: Math.max(Number(promptBlockSummaryRow?.last_hit_at || 0), Number(digestSummaryRow?.last_hit_at || 0)),
            healthyContextCacheLastWriteAt: Math.max(Number(promptBlockSummaryRow?.last_write_at || 0), Number(digestSummaryRow?.last_write_at || 0)),
            cacheEntriesCount: Number(cacheSummaryRow?.entries_count || 0),
            cacheHitCount: Number(cacheSummaryRow?.hit_count || 0),
            cacheLookupCount: Number(cacheStatsRow?.lookup_count || 0),
            cacheRequestHitCount: Number(cacheStatsRow?.hit_count || 0),
            cachedCharactersCount: Number(cacheSummaryRow?.cached_characters_count || 0),
            lastCacheHitAt: Number(cacheSummaryRow?.last_cache_hit_at || 0),
            lastCacheWriteAt: Number(cacheSummaryRow?.last_cache_write_at || 0),
            tokenTotal: Number(tokenRow?.token_total || 0),
            requestCount: Number(tokenRow?.request_count || 0),
            lastMemoryAt: Number(summaryRow?.last_memory_at || 0),
            lastRetrievedAt: Number(summaryRow?.last_retrieved_at || 0),
            lastTokenAt: Number(tokenRow?.last_token_at || 0),
            cacheByCharacter: Array.isArray(cacheByCharacterRows) ? cacheByCharacterRows.map(row => {
                const char = characters.find(item => String(item.id) === String(row.character_id));
                return {
                    character_id: row.character_id,
                    character_name: char?.name || row.character_id,
                    entries_count: Number(row.entries_count || 0),
                    hit_count: Number(row.hit_count || 0),
                    last_hit_at: Number(row.last_hit_at || 0),
                    last_write_at: Number(row.last_write_at || 0)
                };
            }) : [],
            statusNoteCode: '',
            statusNote: '',
            lastError: ''
        };

        const applyIndexedStats = (points, source) => {
            const numericPoints = Math.max(0, Number(points || 0));
            status.indexedPoints = numericPoints;
            status.indexingSource = source || status.indexingSource || 'unknown';
            status.indexingCoverage = status.memoriesCount > 0
                ? Math.min(100, Math.round((numericPoints / status.memoriesCount) * 100))
                : 0;
        };

        if (!config.enabled) {
            applyIndexedStats(status.embeddedMemoriesCount, 'vectra-fallback');
            return res.json({ success: true, status });
        }

        try {
            const info = await dependencies.qdrant.getCollectionInfo(collectionName);
            status.reachable = true;
            status.collectionExists = true;
            const qdrantPoints = Number(
                info?.points_count ??
                info?.vectors_count ??
                info?.indexed_vectors_count ??
                0
            );
            applyIndexedStats(Math.max(qdrantPoints, status.embeddedMemoriesCount), qdrantPoints > 0 ? 'qdrant' : 'vectra-fallback');
            return res.json({ success: true, status });
        } catch (e) {
            const healthy = await dependencies.qdrant.healthcheck();
            status.reachable = healthy;
            status.backend = healthy ? 'qdrant-online-collection-pending' : 'vectra-fallback-active';
            if (healthy && /doesn't exist|not found/i.test(String(e.message || ''))) {
                applyIndexedStats(status.embeddedMemoriesCount, status.embeddedMemoriesCount > 0 ? 'vectra-fallback' : 'qdrant');
                status.statusNoteCode = status.memoriesCount > 0
                    ? 'collection_pending_existing_memories'
                    : 'collection_pending_first_memory';
            } else {
                if (status.embeddedMemoriesCount > 0) {
                    applyIndexedStats(status.embeddedMemoriesCount, 'vectra-fallback');
                }
                status.lastError = e.message;
            }
            return res.json({ success: true, status });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
