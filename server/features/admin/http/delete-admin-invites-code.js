// DELETE /api/admin/invites/:code
function register(dependencies) {
dependencies.app.delete('/api/admin/invites/:code', require("../../../platform/http/trace.js").traceHttp("admin", "DELETE /api/admin/invites/:code"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            const deleted = dependencies.authDb.deleteInviteCode(req.params.code);
            if (!deleted) return res.status(404).json({ error: 'Invite code not found' });
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
