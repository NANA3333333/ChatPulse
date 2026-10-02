// GET /api/characters/:id/cache-stats
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/characters/:id/cache-stats', require("../../../platform/http/trace.js").traceHttp("private-chat", "GET /api/characters/:id/cache-stats"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const charId = req.params.id;
        const character = typeof db.getCharacter === 'function' ? db.getCharacter(charId) : null;
        if (!character) return res.status(404).json({ error: 'Character not found' });

        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        const statsRow = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    MAX(last_hit_at) AS last_hit_at,
                    MAX(created_at) AS last_write_at,
                    MAX(expires_at) AS last_expires_at
                FROM llm_cache
                WHERE character_id = ?
                  AND expires_at > ?
            `).get(charId, Date.now())
            : null;
        const typeRows = rawDb
            ? rawDb.prepare(`
                SELECT
                    cache_type,
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count
                FROM llm_cache
                WHERE character_id = ?
                  AND expires_at > ?
                GROUP BY cache_type
                ORDER BY entries_count DESC, hit_count DESC
            `).all(charId, Date.now())
            : [];
        const promptBlockRows = rawDb
            ? rawDb.prepare(`
                SELECT
                    block_type,
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    MAX(last_hit_at) AS last_hit_at,
                    MAX(updated_at) AS last_write_at
                FROM prompt_block_cache
                WHERE character_id = ?
                GROUP BY block_type
                ORDER BY entries_count DESC, hit_count DESC
            `).all(charId)
            : [];
        const historyWindowRows = rawDb
            ? rawDb.prepare(`
                SELECT
                    window_type,
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    MAX(last_hit_at) AS last_hit_at,
                    MAX(updated_at) AS last_write_at
                FROM history_window_cache
                WHERE character_id = ?
                GROUP BY window_type
                ORDER BY entries_count DESC, hit_count DESC
            `).all(charId)
            : [];
        const promptBlockSummary = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    MAX(last_hit_at) AS last_hit_at,
                    MAX(updated_at) AS last_write_at
                FROM prompt_block_cache
                WHERE character_id = ?
            `).get(charId)
            : null;
        const historyWindowSummary = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    MAX(last_hit_at) AS last_hit_at,
                    MAX(updated_at) AS last_write_at
                FROM history_window_cache
                WHERE character_id = ?
            `).get(charId)
            : null;
        const conversationDigestSummary = rawDb
            ? rawDb.prepare(`
                SELECT
                    COUNT(*) AS entries_count,
                    COALESCE(SUM(hit_count), 0) AS hit_count,
                    MAX(last_hit_at) AS last_hit_at,
                    MAX(updated_at) AS last_write_at,
                    MAX(last_message_id) AS last_message_id
                FROM conversation_digest_cache
                WHERE character_id = ?
            `).get(charId)
            : null;

        res.json({
            success: true,
            stats: {
                character_id: charId,
                character_name: character.name || charId,
                entries_count: Number(statsRow?.entries_count || 0),
                hit_count: Number(statsRow?.hit_count || 0),
                last_hit_at: Number(statsRow?.last_hit_at || 0),
                last_write_at: Number(statsRow?.last_write_at || 0),
                last_expires_at: Number(statsRow?.last_expires_at || 0),
                prompt_block_entries_count: Number(promptBlockSummary?.entries_count || 0),
                prompt_block_hit_count: Number(promptBlockSummary?.hit_count || 0),
                prompt_block_last_hit_at: Number(promptBlockSummary?.last_hit_at || 0),
                prompt_block_last_write_at: Number(promptBlockSummary?.last_write_at || 0),
                history_window_entries_count: Number(historyWindowSummary?.entries_count || 0),
                history_window_hit_count: Number(historyWindowSummary?.hit_count || 0),
                history_window_last_hit_at: Number(historyWindowSummary?.last_hit_at || 0),
                history_window_last_write_at: Number(historyWindowSummary?.last_write_at || 0),
                digest_entries_count: Number(conversationDigestSummary?.entries_count || 0),
                digest_hit_count: Number(conversationDigestSummary?.hit_count || 0),
                digest_last_hit_at: Number(conversationDigestSummary?.last_hit_at || 0),
                digest_last_write_at: Number(conversationDigestSummary?.last_write_at || 0),
                digest_last_message_id: Number(conversationDigestSummary?.last_message_id || 0),
                by_type: Array.isArray(typeRows) ? typeRows.map(row => ({
                    cache_type: row.cache_type,
                    entries_count: Number(row.entries_count || 0),
                    hit_count: Number(row.hit_count || 0)
                })) : [],
                prompt_blocks: Array.isArray(promptBlockRows) ? promptBlockRows.map(row => ({
                    block_type: row.block_type,
                    entries_count: Number(row.entries_count || 0),
                    hit_count: Number(row.hit_count || 0),
                    last_hit_at: Number(row.last_hit_at || 0),
                    last_write_at: Number(row.last_write_at || 0)
                })) : [],
                history_windows: Array.isArray(historyWindowRows) ? historyWindowRows.map(row => ({
                    window_type: row.window_type,
                    entries_count: Number(row.entries_count || 0),
                    hit_count: Number(row.hit_count || 0),
                    last_hit_at: Number(row.last_hit_at || 0),
                    last_write_at: Number(row.last_write_at || 0)
                })) : []
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
