// GET /api/debug/reply-dispatch/:characterId
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/debug/reply-dispatch/:characterId', require("../../../platform/http/trace.js").traceHttp("private-chat", "GET /api/debug/reply-dispatch/:characterId"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const { characterId } = req.params;
        const limit = dependencies.normalizeQueryLimit(req.query.limit, 50, 200);
        if (!limit) return res.status(400).json({ error: 'Invalid reply dispatch log limit' });
        if (typeof db.getReplyDispatchLogs !== 'function') {
            return res.status(501).json({ error: 'Reply dispatch debug is unavailable' });
        }
        res.json(db.getReplyDispatchLogs(characterId, limit));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
