// GET /api/groups
function register(dependencies) {
dependencies.app.get('/api/groups', require("../../../platform/http/trace.js").traceHttp("group-chat", "GET /api/groups"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const memory = dependencies.getMemory(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            res.json(db.getGroups());
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
