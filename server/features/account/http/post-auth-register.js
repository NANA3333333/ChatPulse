// POST /api/auth/register
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/auth/register', require("../../../platform/http/trace.js").traceHttp("account", "POST /api/auth/register"), dependencies.authLimiter, (req, res) => {
    try {
        const { username, password, inviteCode } = req.body;
        if (!username || !password) return res.status(400).json({ error: 'Missing username or password' });
        const result = dependencies.authDb.createUser(username, password, inviteCode);
        if (!result.success) return res.status(400).json({ error: result.error });
        const { token } = dependencies.issueAuthToken(result.user, req);
        dependencies.getUserDb(result.user.id);
        res.json({ success: true, token, user: result.user });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
