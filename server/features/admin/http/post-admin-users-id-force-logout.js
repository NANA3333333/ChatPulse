// POST /api/admin/users/:id/force-logout
function register(dependencies) {
dependencies.app.post('/api/admin/users/:id/force-logout', require("../../../platform/http/trace.js").traceHttp("admin", "POST /api/admin/users/:id/force-logout"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            const targetId = req.params.id;
            if (!dependencies.getMutableAdminTarget(req, res)) return;
            const updated = dependencies.authDb.bumpTokenVersion(targetId);
            if (!updated) return dependencies.sendAdminUserMutationNotFound(res);
            dependencies.authDb.revokeUserSessions(targetId);
            dependencies.disconnectUserSessions(targetId);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
