// DELETE /api/groups/:id
function register(dependencies) {
dependencies.app.delete('/api/groups/:id', require("../../../platform/http/trace.js").traceHttp("group-chat", "DELETE /api/groups/:id"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const memory = dependencies.getMemory(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            engine.stopGroupProactiveTimer(group.id);
            db.deleteGroup(group.id);
            dependencies.clearGroupRuntimeState(req.user.id, group.id);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
