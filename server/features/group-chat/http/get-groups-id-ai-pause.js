// GET /api/groups/:id/ai-pause
function register(dependencies) {
dependencies.app.get('/api/groups/:id/ai-pause', require("../../../platform/http/trace.js").traceHttp("group-chat", "GET /api/groups/:id/ai-pause"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const memory = dependencies.getMemory(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            res.json({ paused: dependencies.pausedGroups.has(dependencies.getGroupRuntimeKey(req.user.id, group.id)) });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
