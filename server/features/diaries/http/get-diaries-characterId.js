// GET /api/diaries/:characterId
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.get('/api/diaries/:characterId', require("../../../platform/http/trace.js").traceHttp("diaries", "GET /api/diaries/:characterId"), dependencies.authMiddleware, (req, res) => {
    const db = req.db;
    const engine = req.engine;
    const memory = req.memory;
    const wsClients = dependencies.getWsClients(req.user.id);
    try {
        const char = db.getCharacter(req.params.characterId);
        if (!char) return res.status(404).json({ error: 'Character not found' });
        const diaries = db.getDiaries(req.params.characterId).map((diary) => ({
            ...diary,
            content: dependencies.sanitizeCityNarrationText(diary.content)
        }));
        res.json({
            isUnlocked: char.is_diary_unlocked === 1,
            entries: diaries
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
