// POST /api/city/characters/:characterId/behavior-branch
function register(dependencies) {
dependencies.app.post('/api/city/characters/:characterId/behavior-branch', require("../../../platform/http/trace.js").traceHttp("city", "POST /api/city/characters/:characterId/behavior-branch"), dependencies.authMiddleware, async (req, res) => {
        try {
            dependencies.ensureCityDb(req.db);
            const char = req.db.getCharacter(req.params.characterId);
            if (!char) return res.status(404).json({ error: '角色不存在' });
            const input = await dependencies.buildBehaviorInputPackage(req.user.id, req.db, char, req.body || {});
            const generated = await dependencies.createBehaviorBranchWithModel(char, input, req.body || {}, req.db);
            res.json({
                success: true,
                skeleton: dependencies.getBehaviorTreeSkeleton(),
                input,
                tree_patch: generated.tree_patch,
                branch: generated.branch,
                raw_output: generated.raw_output,
                json_retry_used: !!generated.json_retry_used,
                fallback: !!generated.fallback,
                error: generated.error || ''
            });
        } catch (e) {
            res.status(e.status || 500).json({
                error: e.message,
                ...(e.canRetry ? { canRetry: true } : {})
            });
        }
    });
}
module.exports = { register };
