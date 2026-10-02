// GET /api/messages/search
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/messages/search', require("../../../platform/http/trace.js").traceHttp("conversation-search", "GET /api/messages/search"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const query = String(req.query.q || '').trim();
        if (!query) return res.json({ success: true, query: '', results: [], has_more: false, next_offset: null, offset: 0, limit: 10 });
        if (query.length > 120) return res.status(400).json({ error: 'Search query is too long' });
        const limit = dependencies.normalizeQueryLimit(req.query.limit, 10, 10);
        if (!limit) return res.status(400).json({ error: 'Invalid search limit' });
        const offset = req.query.offset !== undefined && req.query.offset !== null && String(req.query.offset).trim() !== ''
            ? Number(req.query.offset)
            : 0;
        if (!Number.isSafeInteger(offset) || offset < 0) {
            return res.status(400).json({ error: 'Invalid search offset' });
        }
        const scope = String(req.query.scope || 'all').trim();
        if (!['all', 'private', 'group'].includes(scope)) {
            return res.status(400).json({ error: 'Invalid search scope' });
        }
        const page = typeof db.searchMessages === 'function'
            ? db.searchMessages(query, { limit, scope, offset })
            : { results: [], has_more: false, next_offset: null, offset, limit };
        res.json({ success: true, query, ...page });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
