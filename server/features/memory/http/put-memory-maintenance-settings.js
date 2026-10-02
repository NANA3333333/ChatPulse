// PUT /api/memory-maintenance/settings
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.put('/api/memory-maintenance/settings', require("../../../platform/http/trace.js").traceHttp("memory", "PUT /api/memory-maintenance/settings"), dependencies.authMiddleware, (req, res) => {
    try {
        res.json({ success: true, settings: dependencies.redactMemoryMaintenanceSettings(dependencies.updateMemoryMaintenanceSettings(req.db, req.body || {})) });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message });
    }
});
}
module.exports = { register };
