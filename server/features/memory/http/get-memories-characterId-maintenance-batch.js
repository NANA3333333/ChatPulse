// GET /api/memories/:characterId/maintenance/batch
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memories/:characterId/maintenance/batch', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memories/:characterId/maintenance/batch"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const characterId = req.params.characterId;
        const charObj = db.getCharacter(characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        const batchOptions = dependencies.normalizeMemoryMaintenanceBatchOptions(req.query || {}, { limitFallback: 30 });
        const batch = dependencies.getMemoryMaintenanceBatch(rawDb, characterId, {
            limit: batchOptions.limit,
            offset: batchOptions.offset,
            after_id: batchOptions.after_id,
            status: req.query.status || 'pending',
            include_archived: dependencies.parseBooleanFlag(req.query.include_archived)
        });
        res.json({
            success: true,
            character: { id: charObj.id, name: charObj.name },
            prompt: dependencies.buildMemoryMigrationPrompt(charObj, batch, dependencies.getMemoryMaintenanceSettings(db)),
            task: {
                purpose: 'Classify memories and propose consolidation/forgetting actions. Do not delete memories.',
                recommended_batch_size: 30,
                allowed_memory_focus: Array.from(dependencies.MEMORY_MAINTENANCE_FOCUS),
                allowed_memory_tier: Array.from(dependencies.MEMORY_MAINTENANCE_TIERS),
                allowed_maintenance_status: Array.from(dependencies.MEMORY_MAINTENANCE_STATUS),
                allowed_retention_action: Array.from(dependencies.MEMORY_MAINTENANCE_ACTIONS),
                output_schema: {
                    items: [{
                        id: 'number',
                        memory_focus: 'user_profile | user_current_arc | relationship | general',
                        memory_tier: 'core | active | ambient',
                        importance: '1-10',
                        maintenance_status: 'classified | needs_review | ignored',
                        retention_action: 'keep | downgrade | archive_candidate | merge_candidate | superseded | needs_review',
                        retention_reason: 'short Chinese reason',
                        consolidation_key: 'optional stable key for memories that should be merged',
                        consolidation_summary: 'optional Chinese merged summary proposal'
                    }]
                }
            },
            ...batch
        });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
