// GET /api/characters/:id/impressions/:targetId
function register(dependencies) {
dependencies.app.get('/api/characters/:id/impressions/:targetId', require("../../../platform/http/trace.js").traceHttp("relationships", "GET /api/characters/:id/impressions/:targetId"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        try {
            const limit = dependencies.normalizeImpressionHistoryLimit(req.query.limit);
            if (!limit) return res.status(400).json({ error: 'Invalid impression history limit' });
            const sourceChar = db.getCharacter(req.params.id);
            const targetChar = db.getCharacter(req.params.targetId);
            if (!sourceChar || !targetChar) return res.status(404).json({ error: 'Character not found' });
            const history = db.getCharImpressionHistory(sourceChar.id, targetChar.id, limit);
            res.json(history);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
