// PATCH /api/memories/bulk
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.patch('/api/memories/bulk', require("../../../platform/http/trace.js").traceHttp("memory", "PATCH /api/memories/bulk"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const ids = dependencies.normalizeMemoryIdList(req.body?.ids);
        const patch = dependencies.normalizeManualMemoryPatch(req.body?.patch || req.body || {});
        const characterIds = new Set();
        const idsByCharacter = new Map();
        const previousRowsByCharacter = new Map();
        let updated = 0;
        for (const id of ids) {
            const mem = db.getMemory(id);
            if (!mem) continue;
            db.updateMemory(id, patch);
            updated += 1;
            const characterId = String(mem.character_id || '');
            characterIds.add(characterId);
            if (!idsByCharacter.has(characterId)) idsByCharacter.set(characterId, []);
            if (!previousRowsByCharacter.has(characterId)) previousRowsByCharacter.set(characterId, []);
            idsByCharacter.get(characterId).push(id);
            previousRowsByCharacter.get(characterId).push(mem);
        }
        for (const characterId of characterIds) {
            if (memory?.refreshMemoryIndexEntries) {
                await memory.refreshMemoryIndexEntries(characterId, idsByCharacter.get(characterId) || [], {
                    previousRows: previousRowsByCharacter.get(characterId) || []
                });
            } else if (memory?.rebuildIndex) {
                await memory.rebuildIndex(characterId);
            }
            wsClients.forEach(c => {
                if (c.readyState === 1) c.send(JSON.stringify({ type: 'memory_update', characterId }));
            });
        }
        res.json({ success: true, updated, ids, character_ids: Array.from(characterIds), patch });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
