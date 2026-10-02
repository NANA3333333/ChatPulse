// PUT /api/auth/account
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.put('/api/auth/account', require("../../../platform/http/trace.js").traceHttp("account", "PUT /api/auth/account"), dependencies.authMiddleware, (req, res) => {
    try {
        const { username, currentPassword, newPassword } = req.body || {};
        const result = dependencies.authDb.updateOwnAccount(req.user.id, {
            username,
            currentPassword,
            newPassword
        });
        if (!result.success) return res.status(400).json({ error: result.error });

        dependencies.authDb.revokeUserSessions(req.user.id);
        const { token } = dependencies.issueAuthToken(result.user, req);

        res.json({ success: true, token, user: result.user });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
