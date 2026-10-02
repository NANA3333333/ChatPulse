// POST /api/auth/logout
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/auth/logout', require("../../../platform/http/trace.js").traceHttp("account", "POST /api/auth/logout"), dependencies.authMiddleware, (req, res) => {
    try {
        dependencies.authDb.revokeSession(req.user.id, req.user.sessionId);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
