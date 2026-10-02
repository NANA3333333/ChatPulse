// GET /api/admin/invites/all
function register(dependencies) {
dependencies.app.get('/api/admin/invites/all', require("../../../platform/http/trace.js").traceHttp("admin", "GET /api/admin/invites/all"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            const codes = dependencies.authDb.getInviteCodes();
            res.json({ success: true, codes });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
