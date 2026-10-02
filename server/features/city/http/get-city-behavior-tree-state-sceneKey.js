// GET /api/city/behavior-tree-state/:sceneKey
function register(dependencies) {
dependencies.app.get('/api/city/behavior-tree-state/:sceneKey', require("../../../platform/http/trace.js").traceHttp("city", "GET /api/city/behavior-tree-state/:sceneKey"), dependencies.authMiddleware, async (req, res) => {
        try {
            const sceneKey = dependencies.normalizePixelBehaviorTreeSceneKey(req.params.sceneKey);
            if (!sceneKey) return res.status(400).json({ error: 'Invalid scene key' });
            const state = req.db.getPixelBehaviorTreeState?.(sceneKey) || null;
            res.json({
                success: true,
                scene_key: sceneKey,
                tree: state?.tree || null,
                meta: state?.meta || {},
                updated_at: state?.updated_at || 0,
                revision: state?.revision || 0
            });
        } catch (e) {
            res.status(e.status || 500).json({ error: e.message });
        }
    });
}
module.exports = { register };
