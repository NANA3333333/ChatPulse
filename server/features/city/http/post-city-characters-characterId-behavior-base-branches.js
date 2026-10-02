// POST /api/city/characters/:characterId/behavior-base-branches
function register(dependencies) {
dependencies.app.post('/api/city/characters/:characterId/behavior-base-branches', require("../../../platform/http/trace.js").traceHttp("city", "POST /api/city/characters/:characterId/behavior-base-branches"), dependencies.authMiddleware, async (req, res) => {
        try {
            dependencies.ensureCityDb(req.db);
            const char = req.db.getCharacter(req.params.characterId);
            if (!char) return res.status(404).json({ error: '角色不存在' });
            const rebuildPayload = dependencies.buildBehaviorBaseRebuildPayload(req.body || {});
            const input = await dependencies.buildBehaviorInputPackage(req.user.id, req.db, char, rebuildPayload);
            const generated = await dependencies.createBaseBehaviorBranchesWithModel(char, input, rebuildPayload, req.db);
            res.json({
                success: true,
                skeleton: dependencies.getBehaviorTreeSkeleton(),
                input: {
                    ...input,
                    rebuild_context_reset: true,
                    output_contract: dependencies.getBehaviorBaseOutputContract(input?.world || {})
                },
                base_branches: generated.base_branches,
                base_patches: generated.base_patches,
                interaction_branches: generated.interaction_branches || [],
                interaction_patches: generated.interaction_patches || [],
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
