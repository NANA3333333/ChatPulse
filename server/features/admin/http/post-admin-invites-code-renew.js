// POST /api/admin/invites/:code/renew
function register(dependencies) {
dependencies.app.post('/api/admin/invites/:code/renew', require("../../../platform/http/trace.js").traceHttp("admin", "POST /api/admin/invites/:code/renew"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            const result = dependencies.authDb.renewInviteCode(req.params.code);
            if (!result.success) {
                return res.status(result.statusCode || 400).json({ error: result.error });
            }
            res.json({ success: true, invite: result.invite });
        } catch (e) {
            res.status(e.statusCode === 400 ? 400 : 500).json({ error: e.message });
        }
    });
}
module.exports = { register };
