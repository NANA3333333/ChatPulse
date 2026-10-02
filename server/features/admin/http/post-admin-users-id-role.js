// POST /api/admin/users/:id/role
function register(dependencies) {
dependencies.app.post('/api/admin/users/:id/role', require("../../../platform/http/trace.js").traceHttp("admin", "POST /api/admin/users/:id/role"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            if (req.user.role !== 'root') {
                return res.status(403).json({ error: 'Only root can change roles' });
            }
            const targetId = req.params.id;
            const nextRole = String(req.body?.role || '').trim();
            if (!['user', 'admin'].includes(nextRole)) {
                return res.status(400).json({ error: 'Invalid role' });
            }
            if (!dependencies.getMutableAdminTarget(req, res)) return;
            const updated = dependencies.authDb.setUserRole(targetId, nextRole);
            const tokenUpdated = updated ? dependencies.authDb.bumpTokenVersion(targetId) : 0;
            if (!updated || !tokenUpdated) return dependencies.sendAdminUserMutationNotFound(res);
            dependencies.authDb.revokeUserSessions(targetId);
            dependencies.disconnectUserSessions(targetId);
            res.json({ success: true, role: nextRole });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
