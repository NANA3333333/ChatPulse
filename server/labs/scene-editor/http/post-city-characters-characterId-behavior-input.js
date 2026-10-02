// POST /api/city/characters/:characterId/behavior-input
function register(dependencies) {
dependencies.app.post('/api/city/characters/:characterId/behavior-input', require("../../../platform/http/trace.js").traceHttp("scene-editor", "POST /api/city/characters/:characterId/behavior-input"), dependencies.authMiddleware, async (req, res) => {
        try {
            dependencies.ensureCityDb(req.db);
            const char = req.db.getCharacter(req.params.characterId);
            if (!char) return res.status(404).json({ error: '角色不存在' });
            const input = await dependencies.buildBehaviorInputPackage(req.user.id, req.db, char, req.body || {});
            res.json({ success: true, skeleton: dependencies.getBehaviorTreeSkeleton(), input });
        } catch (e) {
            res.status(e.status || 500).json({
                error: e.message,
                ...(e.canRetry ? { canRetry: true } : {})
            });
        }
    });
}
module.exports = { register };
