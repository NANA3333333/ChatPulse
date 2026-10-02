// POST /api/city/behavior-tree-state/:sceneKey
function register(dependencies) {
dependencies.app.post('/api/city/behavior-tree-state/:sceneKey', require("../../../platform/http/trace.js").traceHttp("city", "POST /api/city/behavior-tree-state/:sceneKey"), dependencies.authMiddleware, async (req, res) => {
        try {
            const sceneKey = dependencies.normalizePixelBehaviorTreeSceneKey(req.params.sceneKey);
            if (!sceneKey) return res.status(400).json({ error: 'Invalid scene key' });
            const tree = dependencies.sanitizePixelBehaviorTreeState(req.body?.tree || req.body?.tree_state || null);
            if (!tree) return res.status(400).json({ error: 'Invalid behavior tree state' });
            const meta = req.body?.meta && typeof req.body.meta === 'object' && !Array.isArray(req.body.meta)
                ? req.body.meta
                : {};
            const saved = req.db.upsertPixelBehaviorTreeState(sceneKey, tree, {
                ...meta,
                saved_by: req.user?.id || '',
                saved_at: Date.now()
            }, req.body?.expected_revision);
            res.json({
                success: true,
                scene_key: saved?.scene_key || sceneKey,
                updated_at: saved.updated_at,
                revision: saved.revision
            });
        } catch (e) {
            res.status(e.status || 500).json({ error: e.message, ...(e.status === 409 ? { revision: e.revision } : {}) });
        }
    });
}
module.exports = { register };
