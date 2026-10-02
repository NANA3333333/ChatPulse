// GET /api/memories/:characterId/maintenance/stats
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memories/:characterId/maintenance/stats', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memories/:characterId/maintenance/stats"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const characterId = req.params.characterId;
        const charObj = db.getCharacter(characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        res.json({
            success: true,
            character: { id: charObj.id, name: charObj.name },
            stats: dependencies.getMemoryMaintenanceStats(rawDb, characterId)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
