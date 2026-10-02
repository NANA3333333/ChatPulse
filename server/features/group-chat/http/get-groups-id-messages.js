// GET /api/groups/:id/messages
function register(dependencies) {
dependencies.app.get('/api/groups/:id/messages', require("../../../platform/http/trace.js").traceHttp("group-chat", "GET /api/groups/:id/messages"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        const engine = dependencies.getEngine(req.user.id);
        const memory = dependencies.getMemory(req.user.id);
        const wsClients = dependencies.getWsClients(req.user.id);
        try {
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            const limit = dependencies.normalizeGroupMessageLimit(req.query.limit);
            if (!limit) return res.status(400).json({ error: 'Invalid message limit' });
            const around = req.query.around !== undefined && req.query.around !== null && String(req.query.around).trim() !== ''
                ? Number(req.query.around)
                : 0;
            if (req.query.around !== undefined && (!Number.isSafeInteger(around) || around <= 0)) {
                return res.status(400).json({ error: 'Invalid around cursor' });
            }
            const after = req.query.after !== undefined && req.query.after !== null && String(req.query.after).trim() !== ''
                ? Number(req.query.after)
                : 0;
            if (req.query.after !== undefined && (!Number.isSafeInteger(after) || after <= 0)) {
                return res.status(400).json({ error: 'Invalid after cursor' });
            }
            if (around && typeof db.getGroupMessagesAround === 'function') {
                return res.json(db.getGroupMessagesAround(group.id, around, limit));
            }
            if (after && typeof db.getGroupMessagesAfter === 'function') {
                return res.json(db.getGroupMessagesAfter(group.id, after, limit));
            }
            res.json(db.getGroupMessages(group.id, limit));
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
