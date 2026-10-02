// GET /api/memory-maintenance/runs
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memory-maintenance/runs', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memory-maintenance/runs"), dependencies.authMiddleware, (req, res) => {
    try {
        dependencies.pruneMemoryMaintenanceRuns();
        const activeOnly = dependencies.parseBooleanFlag(req.query.active);
        const characterId = String(req.query.character_id || '').trim();
        const runs = Array.from(dependencies.memoryMaintenanceRuns.values())
            .filter(run => String(run.user_id) === String(req.user.id))
            .filter(run => !activeOnly || run.running)
            .filter(run => !characterId || String(run.characterId) === characterId)
            .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0))
            .map(dependencies.getMemoryMaintenanceRunSnapshot);
        res.json({ success: true, runs });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
