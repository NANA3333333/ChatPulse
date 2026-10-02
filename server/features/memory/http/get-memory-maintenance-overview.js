// GET /api/memory-maintenance/overview
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memory-maintenance/overview', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memory-maintenance/overview"), dependencies.authMiddleware, async (req, res) => {
    try {
        await dependencies.purgeExpiredForgettingMemoriesForRequest(req, 'memory-maintenance-overview');
        const rawDb = typeof req.db.getRawDb === 'function' ? req.db.getRawDb() : null;
        if (!rawDb) return res.status(500).json({ error: 'Raw database handle is unavailable.' });
        res.json({
            success: true,
            settings: dependencies.redactMemoryMaintenanceSettings(dependencies.getMemoryMaintenanceSettings(req.db)),
            overview: dependencies.getMemoryMaintenanceOverview(rawDb)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
