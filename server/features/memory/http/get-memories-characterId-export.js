// GET /api/memories/:characterId/export
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memories/:characterId/export', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memories/:characterId/export"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const characterId = req.params.characterId;
        const charObj = db.getCharacter(characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });

        const includeArchived = String(req.query.include_archived || '').trim() === '1';
        const memories = db.getMemories(characterId)
            .filter(mem => includeArchived || Number(mem.is_archived || 0) === 0)
            .map(mem => ({
                ...mem,
                embedding: undefined
            }));
        const archive = {
            format: 'chatpulse.memories.v1',
            exported_at: Date.now(),
            character: {
                id: charObj.id,
                name: charObj.name
            },
            character_id: characterId,
            qdrant: {
                strategy: 'rebuild_or_upsert_from_sqlite_memories_on_import',
                exported_points: false
            },
            memories
        };
        const filenameBase = dependencies.sanitizeDownloadName(charObj.name || characterId, characterId);
        const filenameId = dependencies.sanitizeDownloadName(characterId, 'character');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}_${filenameId}_memories_export.json"`);
        res.send(JSON.stringify(archive, null, 2));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
