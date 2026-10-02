// GET /api/system/embedding-status
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/system/embedding-status', require("../../../platform/http/trace.js").traceHttp("memory", "GET /api/system/embedding-status"), dependencies.authMiddleware, async (req, res) => {
    try {
        const status = dependencies.getEmbeddingDebugStatus();
        res.json({
            success: true,
            embedding: status,
            now: Date.now()
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
