// GET /api/characters/:characterId/emotion-logs
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/characters/:characterId/emotion-logs', require("../../../platform/http/trace.js").traceHttp("characters", "GET /api/characters/:characterId/emotion-logs"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const charObj = db.getCharacter(req.params.characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });
        const limit = dependencies.normalizeQueryLimit(req.query.limit, 50, 100);
        if (!limit) return res.status(400).json({ error: 'Invalid emotion log limit' });
        const logs = typeof db.getEmotionLogs === 'function'
            ? db.getEmotionLogs(charObj.id, limit)
            : [];
        res.json({ success: true, logs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
