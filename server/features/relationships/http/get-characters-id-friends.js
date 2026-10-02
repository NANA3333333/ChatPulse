// GET /api/characters/:id/friends
function register(dependencies) {
dependencies.app.get('/api/characters/:id/friends', require("../../../platform/http/trace.js").traceHttp("relationships", "GET /api/characters/:id/friends"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        try {
            const sourceChar = db.getCharacter(req.params.id);
            if (!sourceChar) return res.status(404).json({ error: 'Character not found' });
            const friends = db.getFriends(sourceChar.id);
            res.json(friends);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
