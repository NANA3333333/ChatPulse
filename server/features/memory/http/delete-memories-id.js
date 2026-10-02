// DELETE /api/memories/:id
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.delete('/api/memories/:id', require("../../../platform/http/trace.js").traceHttp("memory", "DELETE /api/memories/:id"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const memoryId = dependencies.normalizeMemoryId(req.params.id);
        const mem = db.getMemory(memoryId);
        if (!mem) return res.status(404).json({ error: 'Memory not found' });
        const indexTargets = dependencies.buildMemoryIndexTargets(db, [mem]);
        const targetCharacters = Array.from((indexTargets.get(memoryId) || new Map()).values());
        const indexResults = [];
        if (memory?.deleteMemoryIndexEntries) {
            for (const target of targetCharacters) {
                const result = await memory.deleteMemoryIndexEntries(target.characterId, [memoryId]);
                indexResults.push({ character_id: target.characterId, ...result });
                if (Array.isArray(result?.errors) && result.errors.length > 0) {
                    console.warn(`[Memory] Index delete warning for ${target.characterId}: ${result.errors.join('; ')}`);
                }
            }
        }
        db.deleteMemory(memoryId);
        const refreshResults = [];
        if (memory?.refreshMemoryIndexEntries) {
            for (const target of targetCharacters) {
                const previousRow = target.previousRow || mem;
                const refreshResult = await memory.refreshMemoryIndexEntries(target.characterId, [memoryId], { previousRows: [previousRow] });
                refreshResults.push({ character_id: target.characterId, ...refreshResult });
            }
        }
        const characterIds = targetCharacters.map(target => target.characterId).filter(Boolean);
        for (const characterId of characterIds) {
            wsClients.forEach(c => {
                if (c.readyState === 1) c.send(JSON.stringify({ type: 'memory_update', characterId }));
            });
        }
        res.json({
            success: true,
            deleted: 1,
            id: memoryId,
            character_id: mem.character_id,
            character_ids: characterIds,
            index_deleted: indexResults.every(result => !Array.isArray(result.errors) || result.errors.length === 0),
            index_results: indexResults,
            index_refresh: refreshResults
        });
    } catch (e) {
        res.status(e.status || 500).json({
            success: false,
            error: e.message,
            partial: e.partial || null,
            details: e.details || null
        });
    }
});
}
module.exports = { register };
