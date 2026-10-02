// GET /api/memory-maintenance/library
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memory-maintenance/library', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memory-maintenance/library"), dependencies.authMiddleware, async (req, res) => {
    try {
        await dependencies.purgeExpiredForgettingMemoriesForRequest(req, 'memory-maintenance-library');
        const rawDb = typeof req.db.getRawDb === 'function' ? req.db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        const options = dependencies.normalizeMemoryMaintenanceLibraryOptions(req.query || {});
        if (options.character_id && !req.db.getCharacter(options.character_id)) {
            return res.status(404).json({ success: false, error: 'Character not found' });
        }
        res.json({
            success: true,
            library: dependencies.getMemoryMaintenanceLibrary(rawDb, options)
        });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
