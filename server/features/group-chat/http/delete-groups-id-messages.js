// DELETE /api/groups/:id/messages
function register(dependencies) {
dependencies.app.delete('/api/groups/:id/messages', require("../../../platform/http/trace.js").traceHttp("group-chat", "DELETE /api/groups/:id/messages"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const memory = dependencies.getMemory(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            db.clearGroupMessages(group.id);
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
