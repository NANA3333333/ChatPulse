// GET /api/memory-maintenance/runs/:runId
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/memory-maintenance/runs/:runId', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/memory-maintenance/runs/:runId"), dependencies.authMiddleware, (req, res) => {
    try {
        dependencies.pruneMemoryMaintenanceRuns();
        const run = dependencies.memoryMaintenanceRuns.get(String(req.params.runId || ''));
        if (!run || String(run.user_id) !== String(req.user.id)) {
            return res.status(404).json({ error: 'Run not found' });
        }
        res.json({ success: true, run: dependencies.getMemoryMaintenanceRunSnapshot(run) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
