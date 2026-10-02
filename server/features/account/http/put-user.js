// PUT /api/user
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.put('/api/user', require("../../../platform/http/trace.js").traceHttp("account", "PUT /api/user"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    const engine = req.engine;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        db.updateUserProfile(req.body);
        res.json({ success: true, profile: {
            ...(db.getUserProfile() || {}),
            username: req.user.username,
            role: req.user.role || 'user',
            created_at: Number(req.user.created_at || 0)
        } });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
