// POST /api/user
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/user', require("../../../platform/http/trace.js").traceHttp("account", "POST /api/user"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const currentProfile = typeof db.getUserProfile === 'function' ? db.getUserProfile() : null;
        if (typeof db.updateUserProfile === 'function') {
            db.updateUserProfile(dependencies.preserveExistingSecretFields(req.body, currentProfile, dependencies.PROFILE_SECRET_FIELDS));
        }
        const updatedProfile = typeof db.getUserProfile === 'function' ? db.getUserProfile() : null;
        res.json({ success: true, profile: dependencies.redactSecretFields({
            ...(updatedProfile || { name: req.user.username }),
            username: req.user.username,
            role: req.user.role || 'user',
            created_at: Number(req.user.created_at || 0)
        }, dependencies.PROFILE_SECRET_FIELDS) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
