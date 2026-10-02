// DELETE /api/memories/bulk
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.delete('/api/memories/bulk', require("../../../platform/http/trace.js").traceHttp("memory", "DELETE /api/memories/bulk"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const ids = dependencies.normalizeMemoryIdList(req.body?.ids);
        const rows = ids
            .map(id => db.getMemory(id))
            .filter(Boolean);
        if (rows.length === 0) {
            return res.json({ success: true, deleted: 0, ids: [], character_ids: [], index_deleted: true });
        }
        const characterIds = new Set();
        const idsByCharacter = new Map();
        const previousRowsByCharacter = new Map();
        const indexTargetsByMemoryId = dependencies.buildMemoryIndexTargets(db, rows);
        for (const mem of rows) {
            const memoryId = Number(mem.id || 0);
            const targets = indexTargetsByMemoryId.get(memoryId) || new Map();
            for (const target of targets.values()) {
                const characterId = String(target.characterId || '');
                if (!characterId) continue;
                characterIds.add(characterId);
                if (!idsByCharacter.has(characterId)) idsByCharacter.set(characterId, []);
                if (!previousRowsByCharacter.has(characterId)) previousRowsByCharacter.set(characterId, []);
                idsByCharacter.get(characterId).push(memoryId);
                previousRowsByCharacter.get(characterId).push(target.previousRow || mem);
            }
        }
        const indexResults = [];
        if (memory?.deleteMemoryIndexEntries) {
            for (const [characterId, memoryIds] of idsByCharacter.entries()) {
                const result = await memory.deleteMemoryIndexEntries(characterId, memoryIds);
                indexResults.push({ character_id: characterId, ...result });
                if (Array.isArray(result?.errors) && result.errors.length > 0) {
                    console.warn(`[Memory] Index delete warning for ${characterId}: ${result.errors.join('; ')}`);
                }
            }
        }
        let deleted = 0;
        for (const mem of rows) {
            db.deleteMemory(mem.id);
            deleted += 1;
        }
        for (const characterId of characterIds) {
            if (memory?.refreshMemoryIndexEntries) {
                const refreshResult = await memory.refreshMemoryIndexEntries(characterId, idsByCharacter.get(characterId) || [], {
                    previousRows: previousRowsByCharacter.get(characterId) || []
                });
                indexResults.push({ character_id: characterId, refresh: refreshResult });
            }
            wsClients.forEach(c => {
                if (c.readyState === 1) c.send(JSON.stringify({ type: 'memory_update', characterId }));
            });
        }
        res.json({
            success: true,
            deleted,
            ids: rows.map(row => row.id),
            character_ids: Array.from(characterIds),
            index_deleted: indexResults.every(result => !Array.isArray(result.errors) || result.errors.length === 0),
            index_results: indexResults
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
