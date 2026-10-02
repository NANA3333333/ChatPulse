// GET /api/data/:characterId/export
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/data/:characterId/export', require("../../../platform/http/trace.js").traceHttp("backup", "GET /api/data/:characterId/export"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    const engine = req.engine;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const data = db.exportCharacterData(req.params.characterId);
        if (!data) return res.status(404).json({ error: 'Character not found' });
        const archive = {
            format: 'chatpulse.character.v2',
            exported_at: Date.now(),
            character_id: req.params.characterId,
            qdrant: {
                strategy: 'rebuild_from_sqlite_memories_on_import',
                collection: dependencies.qdrant.getCollectionName(req.user.id),
                exported_points: false
            },
            ...data
        };
        const filenameBase = dependencies.sanitizeDownloadName(data.character?.name || req.params.characterId, req.params.characterId);
        const filenameId = dependencies.sanitizeDownloadName(req.params.characterId, 'character');

        // Return as a downloadable JSON file
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}_${filenameId}_character_export.json"`);
        res.send(JSON.stringify(archive, null, 2));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
