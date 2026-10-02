// POST /api/admin/announcement
function register(dependencies) {
dependencies.app.post('/api/admin/announcement', require("../../../platform/http/trace.js").traceHttp("admin", "POST /api/admin/announcement"), dependencies.authMiddleware, dependencies.adminMiddleware, (req, res) => {
        try {
            const { content } = req.body;
            dependencies.authDb.setAnnouncement(content);

            // Broadcast over WS to all active users
            const messageStr = JSON.stringify({ type: 'announcement', content });
            dependencies.wss.clients.forEach(client => {
                if (client.readyState === 1 && client.userId) {
                    client.send(messageStr);
                }
            });
            res.json({ success: true, announcement: { content } });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
