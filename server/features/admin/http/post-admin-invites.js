// POST /api/admin/invites
function register(dependencies) {
dependencies.app.post('/api/admin/invites', require("../../../platform/http/trace.js").traceHttp("admin", "POST /api/admin/invites"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            const code = dependencies.authDb.generateInviteCode({
                maxUses: req.body?.maxUses,
                expiresAt: req.body?.expiresAt,
                note: req.body?.note,
                createdBy: req.user.username
            });
            res.json({ success: true, code });
        } catch (e) {
            res.status(e.statusCode === 400 ? 400 : 500).json({ error: e.message });
        }
    });
}
module.exports = { register };
