// PATCH /api/memories/:id
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.patch('/api/memories/:id', require("../../../platform/http/trace.js").traceHttp("memory", "PATCH /api/memories/:id"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const memoryId = dependencies.normalizeMemoryId(req.params.id);
        const mem = db.getMemory(memoryId);
        if (!mem) return res.status(404).json({ error: 'Memory not found' });
        const patch = dependencies.normalizeManualMemoryPatch(req.body || {});
        db.updateMemory(memoryId, patch);
        if (memory?.refreshMemoryIndexEntries) {
            await memory.refreshMemoryIndexEntries(mem.character_id, [memoryId], { previousRows: [mem] });
        } else if (memory?.rebuildIndex) {
            await memory.rebuildIndex(mem.character_id);
        }
        wsClients.forEach(c => {
            if (c.readyState === 1) c.send(JSON.stringify({ type: 'memory_update', characterId: mem.character_id }));
        });
        res.json({
            success: true,
            id: memoryId,
            character_id: mem.character_id,
            patch
        });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
