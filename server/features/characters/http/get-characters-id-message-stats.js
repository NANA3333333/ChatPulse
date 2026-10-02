// GET /api/characters/:id/message-stats
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/characters/:id/message-stats', require("../../../platform/http/trace.js").traceHttp("characters", "GET /api/characters/:id/message-stats"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    try {
        const charObj = db.getCharacter(req.params.id);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });
        const stats = typeof db.getCharacterMessageStats === 'function'
            ? db.getCharacterMessageStats(charObj.id)
            : {
                first_message_at: 0,
                last_message_at: 0,
                last_user_message_at: 0,
                private_message_count: 0,
                user_message_count: 0,
                character_message_count: 0
            };
        res.json({ success: true, stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
