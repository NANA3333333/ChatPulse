// POST /api/memories/:characterId/import
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/memories/:characterId/import', require("../../../platform/http/trace.js").traceHttp("memory", "POST /api/memories/:characterId/import"), dependencies.authMiddleware, (req, res) => {
    dependencies.memoryImportUpload.any()(req, res, async function (err) {
        if (err instanceof dependencies.multer.MulterError) {
            return res.status(400).json({ error: err.message });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        const db = req.db;
        const memory = req.memory;
        try {
            const characterId = req.params.characterId;
            const charObj = db.getCharacter(characterId);
            if (!charObj) return res.status(404).json({ error: 'Character not found' });

            const dryRun = dependencies.parseBooleanFlag(req.query.dry_run ?? req.body?.dry_run);
            const mode = String(req.query.mode ?? req.body?.mode ?? '').trim().toLowerCase();
            const merge = mode === 'merge' || dependencies.parseBooleanFlag(req.query.merge ?? req.body?.merge);
            const replace = !merge && (mode === '' || mode === 'replace' || dependencies.parseBooleanFlag(req.query.replace ?? req.body?.replace));
            const { entries, source } = dependencies.parseMemoryImportRequest(req);
            if (!entries || entries.length === 0) {
                return res.status(400).json({
                    error: 'No importable memories found. Use JSON with a memories array, JSONL, or plain text paragraphs.',
                    acceptedFormats: ['json', 'jsonl', 'txt', 'md']
                });
            }
            if (entries.length > dependencies.MEMORY_IMPORT_MAX_ITEMS) {
                return res.status(413).json({
                    error: `Too many memories in one import. Limit is ${dependencies.MEMORY_IMPORT_MAX_ITEMS}.`,
                    total: entries.length,
                    acceptedFormats: ['json', 'jsonl', 'txt', 'md']
                });
            }

            const errors = [];
            let importedIds = [];
            let warnings = [];
            const preview = [];
            let skipped = 0;
            const normalizedEntries = entries.map((entry, idx) => dependencies.normalizeImportedMemoryEntry(entry, idx));
            const validEntryCount = normalizedEntries.filter(item => !item.error).length;
            if (validEntryCount === 0) {
                return res.status(400).json({
                    error: 'No valid memories found in the import file.',
                    total: entries.length,
                    imported: 0,
                    skipped: entries.length,
                    errors: normalizedEntries.slice(0, 20).map((item, idx) => ({ index: idx, error: item.error || 'Invalid memory.' }))
                });
            }

            if (replace && !dryRun && validEntryCount !== normalizedEntries.length) {
                return res.status(400).json({ error: 'Replace import contains invalid memories. Existing memories were kept.', imported: 0 });
            }

            for (let idx = 0; idx < normalizedEntries.length; idx++) {
                const normalized = normalizedEntries[idx];
                if (normalized.error) {
                    skipped += 1;
                    if (errors.length < 20) errors.push({ index: idx, error: normalized.error });
                    continue;
                }

                const memoryData = normalized.data;
                if (dryRun) {
                    preview.push({
                        index: idx,
                        summary: memoryData.summary,
                        content: memoryData.content,
                        importance: memoryData.importance,
                        memory_type: memoryData.memory_type,
                        memory_tier: memoryData.memory_tier,
                        memory_focus: memoryData.memory_focus
                    });
                    continue;
                }

            }

            if (!dryRun) {
                const result = await memory.importMemories(characterId, normalizedEntries.filter(item => !item.error).map(item => item.data), { replace });
                importedIds = result.ids;
                warnings = result.warnings;
            }

            res.json({
                success: dryRun ? errors.length === 0 : importedIds.length > 0,
                dryRun,
                mode: replace ? 'replace' : 'merge',
                total: entries.length,
                imported: importedIds.length,
                skipped,
                ids: importedIds,
                source,
                acceptedFormats: ['json', 'jsonl', 'txt', 'md'],
                preview: dryRun ? preview : undefined,
                errors,
                warnings
            });
        } catch (e) {
            console.error('Memory import failed:', e);
            res.status(500).json({ error: e.message });
        }
    });
});
}
module.exports = { register };
