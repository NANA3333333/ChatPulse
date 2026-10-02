// GET /api/characters/:characterId/llm-debug-logs
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/characters/:characterId/llm-debug-logs', require("../../../platform/http/trace.js").traceHttp("private-chat", "GET /api/characters/:characterId/llm-debug-logs"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const charObj = db.getCharacter(req.params.characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });
        const limit = dependencies.normalizeQueryLimit(req.query.limit, 50, 200);
        if (!limit) return res.status(400).json({ error: 'Invalid LLM debug log limit' });
        const logs = typeof db.getLlmDebugLogs === 'function'
            ? db.getLlmDebugLogs(charObj.id, limit)
            : [];
        res.json({ success: true, logs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
