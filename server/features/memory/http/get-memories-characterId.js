// GET /api/memories/:characterId
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memories/:characterId', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memories/:characterId"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    const engine = req.engine;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const charObj = db.getCharacter(req.params.characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });
        const includeArchived = String(req.query.include_archived || '').trim() === '1';
        const mems = db.getMemories(charObj.id)
            .filter(mem => includeArchived || Number(mem.is_archived || 0) === 0);
        res.json(mems);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
