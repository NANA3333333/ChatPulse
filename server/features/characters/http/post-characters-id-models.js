// POST /api/characters/:id/models
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/characters/:id/models', require("../../../platform/http/trace.js").traceHttp("characters", "POST /api/characters/:id/models"), dependencies.authMiddleware, async (req, res) => {
    try {
        const character = req.db.getCharacter(req.params.id);
        if (!character) return res.status(404).json({ error: 'Character not found' });
        const scope = String(req.body?.scope || 'main').trim() === 'memory' ? 'memory' : 'main';
        const endpoint = String(req.body?.endpoint || (scope === 'memory' ? character.memory_api_endpoint : character.api_endpoint) || '').trim();
        const key = String(req.body?.key || (scope === 'memory' ? character.memory_api_key : character.api_key) || '').trim();
        return dependencies.handleModelListProxy(req, res, { endpoint, key });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
