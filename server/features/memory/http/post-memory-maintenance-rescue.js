// POST /api/memory-maintenance/rescue
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/memory-maintenance/rescue', require("../../../platform/http/trace.js").traceHttp("memory", "POST /api/memory-maintenance/rescue"), dependencies.authMiddleware, async (req, res) => {
    try {
        const rawDb = typeof req.db.getRawDb === 'function' ? req.db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        const result = dependencies.rescueMemoryMaintenanceItems(rawDb, req.body?.ids || []);
        const rebuilt = [];
        if (dependencies.parseBooleanFlag(req.query.rebuild_index ?? req.body?.rebuild_index)) {
            for (const characterId of result.characterIds) {
                try {
                    await req.memory.rebuildIndex(characterId);
                    rebuilt.push(characterId);
                } catch (e) {
                    console.error(`[Memory Maintenance] Failed to rebuild rescued memory index for ${characterId}:`, e.message);
                }
            }
        }
        const wsClients = dependencies.getWsClients(req.user.id);
        result.characterIds.forEach(characterId => {
            wsClients.forEach(c => {
                if (c.readyState === 1) c.send(JSON.stringify({ type: 'memory_update', characterId }));
            });
        });
        res.json({
            success: true,
            rescued: result.rescued,
            characterIds: result.characterIds,
            rebuilt,
            overview: dependencies.getMemoryMaintenanceOverview(rawDb)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
