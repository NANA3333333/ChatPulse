// GET /api/user
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/user', require("../../../platform/http/trace.js").traceHttp("account", "GET /api/user"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const profile = typeof db.getUserProfile === 'function' ? db.getUserProfile() : null;
        res.json(dependencies.redactSecretFields({
            ...(profile || { name: req.user.username }),
            username: req.user.username,
            role: req.user.role || 'user',
            created_at: Number(req.user.created_at || 0)
        }, dependencies.PROFILE_SECRET_FIELDS));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
