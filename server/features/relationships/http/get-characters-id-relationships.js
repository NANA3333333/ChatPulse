// GET /api/characters/:id/relationships
function register(dependencies) {
dependencies.app.get('/api/characters/:id/relationships', require("../../../platform/http/trace.js").traceHttp("relationships", "GET /api/characters/:id/relationships"), dependencies.authMiddleware, (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        try {
            const sourceChar = db.getCharacter(req.params.id);
            if (!sourceChar) return res.status(404).json({ error: 'Character not found' });
            const relationships = db.getCharRelationships(sourceChar.id);
            // Enrich with character names and avatars — skip if target no longer exists
            const enriched = relationships
                .filter(r => db.getCharacter(r.targetId) !== undefined)
                .map(r => {
                    const targetChar = db.getCharacter(r.targetId);
                    return {
                        ...r,
                        targetName: targetChar?.name || 'Unknown',
                        targetAvatar: targetChar?.avatar || ''
                    };
                });
            res.json(enriched);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
