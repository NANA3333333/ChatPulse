// GET /api/auth/sessions
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/auth/sessions', require("../../../platform/http/trace.js").traceHttp("account", "GET /api/auth/sessions"), dependencies.authMiddleware, (req, res) => {
    try {
        const sessions = dependencies.authDb.getUserSessions(req.user.id).map(session => ({
            ...session,
            current: session.id === req.user.sessionId
        }));
        res.json({ success: true, sessions });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
