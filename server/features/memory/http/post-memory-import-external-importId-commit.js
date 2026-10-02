// POST /api/memory-import/external/:importId/commit
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/memory-import/external/:importId/commit', require("../../../platform/http/trace.js").traceHttp("memory", "POST /api/memory-import/external/:importId/commit"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const memory = req.memory;
    try {
        const importId = dependencies.normalizeMemoryId(req.params.importId);
        const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        const row = rawDb.prepare('SELECT * FROM external_memory_imports WHERE id = ?').get(importId);
        if (!row) return res.status(404).json({ error: 'External import preview not found.' });
        const parsedSummary = dependencies.tryParseJsonValue(row.summary_json || '{}');
        const summary = parsedSummary.ok ? parsedSummary.value : {};
        const candidates = Array.isArray(summary.candidates) ? summary.candidates : [];
        const roleTags = Array.isArray(summary.role_tags) ? summary.role_tags : [];
        const rawSelectedNames = Array.isArray(req.body?.selected_role_names)
            ? req.body.selected_role_names
            : (Array.isArray(req.body?.role_names) ? req.body.role_names : []);
        const requestedNames = Array.from(new Set(rawSelectedNames
            .map(name => dependencies.normalizeExternalCharacterName(name))
            .filter(Boolean)));
        const defaultNames = roleTags.map(tag => dependencies.normalizeExternalCharacterName(tag.name)).filter(Boolean);
        const selectedNames = requestedNames.length ? requestedNames : defaultNames;
        if (!selectedNames.length) return res.status(400).json({ error: '请选择至少一个角色标签。' });

        const settings = dependencies.getMemoryMaintenanceSettings(db);
        const selectedSet = new Set(selectedNames.map(name => name.toLowerCase()));
        const profilesByName = new Map(roleTags.map(tag => [String(tag.name || '').trim().toLowerCase(), tag.profile || tag]));
        const selectedRoleTags = roleTags.filter(tag => selectedSet.has(dependencies.normalizeExternalCharacterName(tag.name).toLowerCase()));
        const selectedCandidates = [];
        for (const candidate of candidates) {
            let candidateNames = (Array.isArray(candidate.character_names) ? candidate.character_names : [])
                .map(name => dependencies.normalizeExternalCharacterName(name))
                .filter(name => selectedSet.has(name.toLowerCase()));
            if (!candidateNames.length && String(row.import_mode || '') === 'one_to_one' && selectedNames.length === 1) {
                candidateNames = selectedNames.slice(0, 1);
            }
            if (!candidateNames.length) continue;
            selectedCandidates.push({
                ...candidate,
                character_names: Array.from(new Set(candidateNames))
            });
        }
        if (selectedCandidates.length <= 0) {
            return res.status(400).json({ error: '所选角色没有匹配到可写入的导入候选。' });
        }

        const normalized = {
            source_app: row.source_app || summary.source_app || 'external_app',
            import_mode: row.import_mode || summary.import_mode || 'multi_role',
            role_tags: selectedRoleTags.length
                ? selectedRoleTags
                : selectedNames.map(name => ({ name, confidence: 1, reason: '用户选择导入。', profile: profilesByName.get(name.toLowerCase()) || { name, persona: '' } })),
            candidates: selectedCandidates,
            needs_review: Array.isArray(summary.needs_review) ? summary.needs_review : []
        };
        const applyResult = await dependencies.saveExternalImportCandidatesDirect({
            db,
            memory,
            settings,
            importId,
            sourceApp: normalized.source_app,
            importMode: normalized.import_mode,
            normalized,
            dryRun: false
        });
        if (applyResult.saved_count <= 0 && applyResult.error_count > 0) {
            return res.status(422).json({ error: '导入候选保存失败。', errors: applyResult.errors });
        }

        rawDb.prepare(`
            UPDATE external_memory_imports
            SET selected_character_ids_json = ?,
                memory_ids_json = ?,
                committed_at = ?
            WHERE id = ?
        `).run(
            JSON.stringify(applyResult.characters.map(character => character.id)),
            JSON.stringify(applyResult.saved),
            Date.now(),
            importId
        );

        const wsClients = dependencies.getWsClients(req.user.id);
        for (const item of applyResult.saved || []) {
            if (item.character_id) {
                dependencies.broadcastToWsClients(wsClients, { type: 'memory_update', characterId: item.character_id });
            }
        }
        wsClients.forEach(c => {
            if (c.readyState === 1) {
                c.send(JSON.stringify({ type: 'refresh_contacts' }));
            }
        });

        res.json({
            success: applyResult.saved_count > 0,
            import_id: importId,
            imported_as: 'external_direct',
            characters: applyResult.characters,
            queued: 0,
            imported: applyResult.saved_count,
            ids: applyResult.saved.map(item => item.memory_id).filter(Boolean),
            skipped: applyResult.skipped,
            errors: applyResult.errors
        });
    } catch (e) {
        console.error('External memory import commit failed:', e);
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
