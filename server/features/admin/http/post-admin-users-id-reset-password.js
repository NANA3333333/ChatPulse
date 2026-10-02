// POST /api/admin/users/:id/reset-password
function register(dependencies) {
dependencies.app.post('/api/admin/users/:id/reset-password', require("../../../platform/http/trace.js").traceHttp("admin", "POST /api/admin/users/:id/reset-password"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            const targetId = req.params.id;
            if (!dependencies.getMutableAdminTarget(req, res)) return;
            const newPassword = String(req.body?.password || '');
            if (newPassword.length < 8) {
                return res.status(400).json({ error: 'Password must be at least 8 characters long' });
            }
            const updated = dependencies.authDb.resetPassword(targetId, newPassword);
            if (!updated) return dependencies.sendAdminUserMutationNotFound(res);
            dependencies.authDb.revokeUserSessions(targetId);
            dependencies.disconnectUserSessions(targetId);
            res.json({ success: true });
        } catch (e) {
            res.status(e.statusCode === 400 ? 400 : 500).json({ error: e.message });
        }
    });
}
module.exports = { register };
