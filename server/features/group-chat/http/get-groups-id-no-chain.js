// GET /api/groups/:id/no-chain
function register(dependencies) {
dependencies.app.get('/api/groups/:id/no-chain', require("../../../platform/http/trace.js").traceHttp("group-chat", "GET /api/groups/:id/no-chain"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const memory = dependencies.getMemory(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            res.json({ noChain: dependencies.noChainGroups.has(dependencies.getGroupRuntimeKey(req.user.id, group.id)) });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
