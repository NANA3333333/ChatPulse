// PUT /api/admin/invites/:code
function register(dependencies) {
dependencies.app.put('/api/admin/invites/:code', require("../../../platform/http/trace.js").traceHttp("admin", "PUT /api/admin/invites/:code"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            const updated = dependencies.authDb.updateInviteCode(req.params.code, {
                status: req.body?.status,
                note: req.body?.note,
                maxUses: req.body?.maxUses,
                expiresAt: req.body?.expiresAt
            });
            if (!updated) return res.status(404).json({ error: 'Invite code not found' });
            res.json({ success: true });
        } catch (e) {
            res.status(e.statusCode === 400 ? 400 : 500).json({ error: e.message });
        }
    });
}
module.exports = { register };
