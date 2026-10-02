// DELETE /api/admin/users/:id
function register(dependencies) {
dependencies.app.delete('/api/admin/users/:id', require("../../../platform/http/trace.js").traceHttp("admin", "DELETE /api/admin/users/:id"), dependencies.authMiddleware, dependencies.adminMiddleware, async (req, res) => {
        try {
            const targetId = req.params.id;
            if (targetId === req.user.id) return res.status(400).json({ error: "Cannot delete yourself" });
            if (!dependencies.getMutableAdminTarget(req, res)) return;
            dependencies.markUserDbDeleting(targetId);

            const deleted = dependencies.authDb.deleteUser(targetId);
            if (!deleted) {
                dependencies.unmarkUserDbDeleting(targetId);
                return dependencies.sendAdminUserMutationNotFound(res);
            }

            dependencies.authDb.revokeUserSessions(targetId);
            dependencies.disconnectUserSessions(targetId);

            try {
                await dependencies.cleanupUserStorage(targetId);
                dependencies.unmarkUserDbDeleting(targetId);
                res.json({ success: true, queuedCleanup: false });
            } catch (e) {
                const code = String(e?.code || '');
                if (['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(code)) {
                    dependencies.scheduleDeferredUserDeletion(targetId);
                    return res.json({ success: true, queuedCleanup: true });
                }
                throw e;
            }
        } catch (e) {
            try { dependencies.unmarkUserDbDeleting(req.params.id); } catch (err) { }
            console.error(e);
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
