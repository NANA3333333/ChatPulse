// POST /api/memories/:characterId/maintenance/apply
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/memories/:characterId/maintenance/apply', require("../../../platform/http/trace.js").traceHttp("memory", "POST /api/memories/:characterId/maintenance/apply"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const memory = req.memory;
    try {
        const characterId = req.params.characterId;
        const charObj = db.getCharacter(characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        const items = Array.isArray(req.body?.items) ? req.body.items : (Array.isArray(req.body) ? req.body : []);
        if (items.length === 0) {
            return res.status(400).json({ error: 'items array is required.' });
        }
        if (items.length > 100) {
            return res.status(413).json({ error: 'Too many maintenance items. Limit is 100.' });
        }
        const result = dependencies.applyMemoryMaintenanceItems(rawDb, characterId, items, req.body?.source || 'small-model');
        const requestedFullRebuild = dependencies.parseBooleanFlag(req.query.rebuild_index ?? req.body?.rebuild_index);
        let indexRefresh = null;
        let indexRefreshWarning = '';
        if (!requestedFullRebuild) {
            try {
                indexRefresh = await dependencies.refreshMaintenanceMemoryIndex(memory, characterId, result);
            } catch (e) {
                indexRefreshWarning = e.message || 'Memory index refresh failed.';
                console.error(`[Memory Maintenance] Failed to refresh memory index for ${characterId}:`, indexRefreshWarning);
            }
        }
        let rebuiltMemoryIndex = false;
        let rebuildWarning = '';
        if (requestedFullRebuild) {
            try {
                await memory.rebuildIndex(characterId);
                rebuiltMemoryIndex = true;
            } catch (e) {
                rebuildWarning = e.message || 'Memory index rebuild failed.';
                console.error(`[Memory Maintenance] Failed to rebuild memory index for ${characterId}:`, rebuildWarning);
            }
        }
        const wsClients = dependencies.getWsClients(req.user.id);
        wsClients.forEach(c => {
            if (c.readyState === 1) {
                c.send(JSON.stringify({ type: 'memory_update', characterId }));
            }
        });
        res.json({
            success: result.updated > 0,
            character: { id: charObj.id, name: charObj.name },
            updated: result.updated,
            errors: result.errors,
            indexRefresh,
            indexRefreshWarning,
            rebuiltMemoryIndex,
            rebuildWarning,
            stats: dependencies.getMemoryMaintenanceStats(rawDb, characterId)
        });
    } catch (e) {
        console.error('Memory maintenance apply failed:', e);
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
