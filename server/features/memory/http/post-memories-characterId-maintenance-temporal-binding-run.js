// POST /api/memories/:characterId/maintenance/temporal-binding-run
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/memories/:characterId/maintenance/temporal-binding-run', require("../../../platform/http/trace.js").traceHttp("memory", "POST /api/memories/:characterId/maintenance/temporal-binding-run"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const memory = req.memory;
    try {
        const characterId = req.params.characterId;
        const charObj = db.getCharacter(characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        const settings = dependencies.getMemoryMaintenanceSettings(db);
        if (!settings.api_endpoint || !settings.api_key || !settings.model_name) {
            return res.status(400).json({ error: 'Memory maintenance model URL, key, and model are required.' });
        }
        const result = await dependencies.runMemoryTemporalBindingBatch(rawDb, charObj, settings, {
            limit: req.body?.limit,
            offset: req.body?.offset,
            source: req.body?.source || 'new',
            include_archived: req.body?.include_archived,
            dry_run: req.body?.dry_run,
            source_name: 'small-model-temporal-binding'
        });
        let rebuiltMemoryIndex = false;
        let rebuildWarning = '';
        if (!result.empty && dependencies.parseBooleanFlag(req.body?.rebuild_index)) {
            try {
                await memory.rebuildIndex(characterId);
                rebuiltMemoryIndex = true;
            } catch (e) {
                rebuildWarning = e.message || 'Memory index rebuild failed.';
            }
        }
        const wsClients = dependencies.getWsClients(req.user.id);
        wsClients.forEach(c => {
            if (c.readyState === 1) c.send(JSON.stringify({ type: 'memory_update', characterId }));
        });
        res.json({
            ...result,
            rebuiltMemoryIndex,
            rebuildWarning
        });
    } catch (e) {
        if (e?.payload) {
            return res.status(e.status || 500).json(e.payload);
        }
        console.error('Memory temporal binding run failed:', e);
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
