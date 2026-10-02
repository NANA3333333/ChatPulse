// GET /api/city/characters/:characterId/behavior-models
function register(dependencies) {
dependencies.app.get('/api/city/characters/:characterId/behavior-models', require("../../../platform/http/trace.js").traceHttp("scene-editor", "GET /api/city/characters/:characterId/behavior-models"), dependencies.authMiddleware, async (req, res) => {
        try {
            dependencies.ensureCityDb(req.db);
            const char = req.db.getCharacter(req.params.characterId);
            if (!char) return res.status(404).json({ error: '角色不存在' });
            if (!char.api_endpoint || !char.api_key) return res.status(400).json({ error: '绑定角色没有可用的 URL/Key' });
            const models = await dependencies.fetchBehaviorModelList(char.api_endpoint, char.api_key);
            res.json({
                success: true,
                models,
                endpoint: char.api_endpoint || '',
                model_name: char.model_name || ''
            });
        } catch (e) {
            res.status(e.statusCode === 400 ? 400 : 500).json({ error: e.message });
        }
    });
}
module.exports = { register };
