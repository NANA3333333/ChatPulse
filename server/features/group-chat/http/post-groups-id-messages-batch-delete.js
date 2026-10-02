// POST /api/groups/:id/messages/batch-delete
function register(dependencies) {
dependencies.app.post('/api/groups/:id/messages/batch-delete', require("../../../platform/http/trace.js").traceHttp("group-chat", "POST /api/groups/:id/messages/batch-delete"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        try {
            const { messageIds } = req.body;
            if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
                return res.status(400).json({ error: 'messageIds array required' });
            }
            const group = db.getGroup(req.params.id);
            if (!group) return res.status(404).json({ error: 'Group not found' });
            const deleted = db.deleteGroupMessages(group.id, messageIds);
            res.json({ success: true, deleted });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
