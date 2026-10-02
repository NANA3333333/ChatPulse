// POST /api/diaries/:characterId/unlock
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/diaries/:characterId/unlock', require("../../../platform/http/trace.js").traceHttp("diaries", "POST /api/diaries/:characterId/unlock"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    const engine = req.engine;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const character = db.getCharacter(req.params.characterId);
        if (!character) return res.status(404).json({ error: 'Character not found' });
        const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';
        if (!password) return res.status(400).json({ success: false, reason: 'No password provided.' });
        const result = db.verifyAndUnlockDiary(character.id, password);
        if (result.success) {
            res.json({ success: true });
        } else {
            res.status(403).json({ success: false, reason: result.reason });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
