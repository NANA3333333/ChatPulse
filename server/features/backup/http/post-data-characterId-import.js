// POST /api/data/:characterId/import
// Kept separate from startup so this operation can be exercised with isolated dependencies.
const { importCharacterArchive } = require('../characterImportService');
function register(app, dependencies) {
app.post('/api/data/:characterId/import', require("../../../platform/http/trace.js").traceHttp("backup", "POST /api/data/:characterId/import"), dependencies.authMiddleware, (req, res) => {
    dependencies.memoryImportUpload.any()(req, res, async function (err) {
        if (err instanceof dependencies.multer.MulterError) {
            return res.status(400).json({ error: err.message });
        }
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        const db = req.db;
        const memory = req.memory;
        const engine = req.engine;
        try {
            const characterId = req.params.characterId;
            const payload = dependencies.parseCharacterArchiveRequest(req);
            const existing = db.getCharacter(characterId);
            const mode = String(req.query.mode ?? req.body?.mode ?? '').trim().toLowerCase();
            const merge = mode === 'merge' || dependencies.parseBooleanFlag(req.query.merge ?? req.body?.merge);
            const replace = !merge && (mode === '' || mode === 'replace' || dependencies.parseBooleanFlag(req.query.replace ?? req.body?.replace));
            const includeCharacter = !dependencies.parseBooleanFlag(req.query.skip_character ?? req.body?.skip_character);
            if (!existing && (!includeCharacter || !payload.character)) {
                return res.status(404).json({ error: 'Target character does not exist, and the archive cannot create it with the current import options.' });
            }
            if (!existing && !String(payload.character?.name || '').trim()) {
                return res.status(400).json({ error: 'Archive character name is required to create a missing target character.' });
            }
            const rawDb = typeof db.getRawDb === 'function' ? db.getRawDb() : null;
            if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });

            const wsClients = dependencies.getWsClients(req.user.id);
            const { imported, rebuiltMemoryIndex, rebuildWarning } = await importCharacterArchive({
                db, rawDb, memory, engine, wsClients, characterId, payload, includeCharacter, replace,
                clearCharacterArchiveData: dependencies.clearCharacterArchiveData,
                runArchiveCleanup: dependencies.runArchiveCleanup,
                importCharacterArchiveRows: dependencies.importCharacterArchiveRows,
            });
            wsClients.forEach(c => {
                if (c.readyState === 1) {
                    c.send(JSON.stringify({ type: 'memory_update', characterId }));
                }
            });

            res.json({
                success: true,
                characterId,
                mode: replace ? 'replace' : 'merge',
                imported,
                rebuiltMemoryIndex,
                qdrant: {
                    strategy: 'rebuilt_from_imported_sqlite_memories',
                    rebuilt: rebuiltMemoryIndex,
                    warning: rebuildWarning
                }
            });
        } catch (e) {
            console.error('Character archive import failed:', e);
            res.status(e.status || 500).json({ error: e.message });
        }
    });
});
}
module.exports = { register };
