// POST /api/admin/users/:id/ban
function register(dependencies) {
dependencies.app.post('/api/admin/users/:id/ban', require("../../../platform/http/trace.js").traceHttp("admin", "POST /api/admin/users/:id/ban"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            const targetId = req.params.id;
            if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot ban yourself' });
            if (!dependencies.getMutableAdminTarget(req, res)) return;
            const banned = !!req.body?.banned;
            const status = banned ? 'banned' : 'active';
            const updated = dependencies.authDb.setUserStatus(targetId, status);
            const tokenUpdated = updated ? dependencies.authDb.bumpTokenVersion(targetId) : 0;
            if (!updated || !tokenUpdated) return dependencies.sendAdminUserMutationNotFound(res);
            dependencies.authDb.revokeUserSessions(targetId);
            dependencies.disconnectUserSessions(targetId);
            res.json({ success: true, status });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
