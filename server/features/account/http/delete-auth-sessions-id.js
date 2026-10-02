// DELETE /api/auth/sessions/:id
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.delete('/api/auth/sessions/:id', require("../../../platform/http/trace.js").traceHttp("account", "DELETE /api/auth/sessions/:id"), dependencies.authMiddleware, (req, res) => {
    try {
        const revoked = dependencies.authDb.revokeSession(req.user.id, req.params.id);
        if (!revoked) return res.status(404).json({ error: 'Session not found' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
