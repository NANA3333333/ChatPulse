// GET /api/memories/:characterId/maintenance/temporal-binding-batch
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memories/:characterId/maintenance/temporal-binding-batch', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memories/:characterId/maintenance/temporal-binding-batch"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const characterId = req.params.characterId;
        const charObj = db.getCharacter(characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        const batchOptions = dependencies.normalizeMemoryMaintenanceBatchOptions(req.query || {}, { limitFallback: 40 });
        const batch = dependencies.getMemoryTemporalBindingBatch(rawDb, characterId, {
            limit: batchOptions.limit,
            offset: batchOptions.offset,
            source: dependencies.normalizeMemoryTemporalBindingSource(req.query.source || 'new'),
            include_archived: dependencies.parseBooleanFlag(req.query.include_archived)
        });
        const knownIds = (batch.items || []).map(item => item.id);
        res.json({
            success: true,
            character: { id: charObj.id, name: charObj.name },
            prompt: dependencies.buildMemoryTemporalBindingPrompt(charObj, batch, dependencies.getMemoryMaintenanceSettings(db)),
            task: {
                purpose: 'Source/scene and time-label-only pass for existing memories. Do not change memory_focus, do not summarize, do not delete memories.',
                recommended_batch_size: 40,
                allowed_source_contexts: Array.from(dependencies.MEMORY_SOURCE_CONTEXTS),
                allowed_scene_tags: Array.from(dependencies.MEMORY_SCENE_TAGS),
                allowed_labels: Array.from(dependencies.MEMORY_TEMPORAL_BINDING_LABELS),
                allowed_scopes: Array.from(dependencies.MEMORY_TEMPORAL_BINDING_SCOPES),
                output_schema: {
                    source_labels: [{
                        id: 'number',
                        source_context: Array.from(dependencies.MEMORY_SOURCE_CONTEXTS).join(' | '),
                        scene_tag: Array.from(dependencies.MEMORY_SCENE_TAGS).join(' | '),
                        source_app: 'optional short app name',
                        confidence: '0.0-1.0',
                        reason: 'short Chinese reason'
                    }],
                    time_labels: [{
                        id: 'number',
                        is_time_bound: 'boolean',
                        label: Array.from(dependencies.MEMORY_TEMPORAL_BINDING_LABELS).join(' | '),
                        scope: Array.from(dependencies.MEMORY_TEMPORAL_BINDING_SCOPES).join(' | '),
                        time_anchor: 'short Chinese time anchor',
                        confidence: '0.0-1.0',
                        reason: 'short Chinese reason'
                    }],
                    needs_review: [{ id: 'number', reason: 'short Chinese reason' }],
                    not_time_bound_ids: ['number']
                },
                validator: 'normalizeTemporalBindingResult',
                known_ids: knownIds
            },
            ...batch
        });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
