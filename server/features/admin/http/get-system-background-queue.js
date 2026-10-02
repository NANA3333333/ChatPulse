// GET /api/system/background-queue
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/system/background-queue', require("../../../platform/http/trace.js").traceHttp("admin", "GET /api/system/background-queue"), dependencies.authMiddleware, (req, res) => {
    try {
        const includeAll = dependencies.authDb.isAdminRole(req.user.role);
        res.json({
            success: true,
            stats: dependencies.getBackgroundQueueStats(includeAll ? {} : { userId: req.user.id }),
            now: Date.now()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
