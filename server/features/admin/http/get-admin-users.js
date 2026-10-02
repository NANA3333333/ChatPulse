// GET /api/admin/users
function register(dependencies) {
dependencies.app.get('/api/admin/users', require("../../../platform/http/trace.js").traceHttp("admin", "GET /api/admin/users"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            const users = dependencies.authDb.getAllUsers().map(user => ({
                ...user,
                stats: dependencies.getUserStats(user)
            }));
            res.json({ success: true, users });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
