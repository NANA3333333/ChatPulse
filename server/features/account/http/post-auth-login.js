// POST /api/auth/login
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/auth/login', require("../../../platform/http/trace.js").traceHttp("account", "POST /api/auth/login"), dependencies.authLimiter, (req, res) => {
    try {
        const { username, password } = req.body;
        const result = dependencies.authDb.verifyUser(username, password, dependencies.getRequestAuthMeta(req));
        if (!result.success) return res.status(401).json({ error: result.error });
        const { token } = dependencies.issueAuthToken(result.user, req);
        dependencies.getUserDb(result.user.id);
        res.json({ success: true, token, user: result.user });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
