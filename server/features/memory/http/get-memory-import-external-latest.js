// GET /api/memory-import/external/latest
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memory-import/external/latest', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memory-import/external/latest"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        const row = rawDb.prepare(`
            SELECT id,
                   source_app,
                   import_mode,
                   filename,
                   created_at,
                   committed_at,
                   summary_json,
                   role_tags_json,
                   normalized_messages_json
            FROM external_memory_imports
            WHERE COALESCE(committed_at, 0) = 0
            ORDER BY id DESC
            LIMIT 1
        `).get();
        if (!row) {
            return res.json({ success: true, import: null });
        }
        const normalized = dependencies.safeJsonParse(row.summary_json, {});
        const roleTags = Array.isArray(normalized.role_tags)
            ? normalized.role_tags
            : dependencies.safeJsonParse(row.role_tags_json, []);
        const candidates = Array.isArray(normalized.candidates) ? normalized.candidates : [];
        const messages = dependencies.safeJsonParse(row.normalized_messages_json, []);
        res.json({
            success: true,
            import: {
                id: row.id,
                source_app: row.source_app || '',
                import_mode: row.import_mode || '',
                filename: row.filename || '',
                message_count: Array.isArray(messages) ? messages.length : 0,
                created_at: row.created_at || 0,
                committed_at: row.committed_at || 0,
                restored: true
            },
            role_tags: Array.isArray(roleTags) ? roleTags : [],
            candidates,
            needs_review: Array.isArray(normalized.needs_review) ? normalized.needs_review : [],
            restored: true
        });
    } catch (e) {
        console.error('Load latest external memory import failed:', e);
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
