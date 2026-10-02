// POST /api/desktop/session
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/desktop/session', require("../../../platform/http/trace.js").traceHttp("account", "POST /api/desktop/session"), (req, res) => {
    try {
        if (!dependencies.DESKTOP_MODE || !dependencies.isLocalRequest(req)) {
            return res.status(404).json({ error: 'Not found' });
        }
        const expectedToken = String(process.env.CP_DESKTOP_SESSION_TOKEN || '');
        const providedToken = String(req.get('x-chatpulse-desktop-token') || '');
        if (!expectedToken || providedToken !== expectedToken) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const desktopUsername = String(process.env.CP_DESKTOP_USERNAME || 'Nana').trim() || 'Nana';
        const authUser = dependencies.authDb.getUserByUsername(desktopUsername) || dependencies.authDb.getUserByUsername('Nana');
        if (!authUser) return res.status(404).json({ error: 'Desktop user not found' });
        const user = {
            id: authUser.id,
            username: authUser.username,
            role: authUser.role || 'user',
            status: authUser.status || 'active',
            tokenVersion: authUser.token_version || 0
        };
        const { token } = dependencies.issueAuthToken(user, req);
        dependencies.getUserDb(user.id);
        res.json({ success: true, token, user });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
