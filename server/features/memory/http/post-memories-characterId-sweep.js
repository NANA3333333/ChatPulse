// POST /api/memories/:characterId/sweep
// Kept separate from startup so this operation can be exercised with isolated dependencies.
function register(app, dependencies) {
app.post('/api/memories/:characterId/sweep', require("../../../platform/http/trace.js").traceHttp("memory", "POST /api/memories/:characterId/sweep"), dependencies.authMiddleware, async (req, res) => {
    const db = req.db;
    const memory = req.memory;
    try {
        const charObj = db.getCharacter(req.params.characterId);
        if (!charObj) return res.status(404).json({ error: 'Character not found' });

        if (!charObj.memory_api_endpoint || !charObj.memory_api_key || !charObj.memory_model_name) {
            return res.status(400).json({ error: 'Memory AI (Small Model) is not fully configured for this character.' });
        }

        const requestedPool = req.body?.pool || req.query?.pool || 'auto';
        const sweepResult = await memory.sweepOverflowMemories(charObj, { pool: requestedPool });
        const refreshed = db.getCharacter(req.params.characterId);
        const lastError = refreshed?.sweep_last_error || '';
        const savedCount = Number(sweepResult?.savedCount || 0);
        const sweepPool = sweepResult?.pool || requestedPool || 'auto';

        if (sweepResult?.status === 'running') {
            return res.status(409).json({
                success: false,
                error: sweepResult.error || lastError || 'Another long-term memory sweep is already running.',
                savedCount,
                pool: sweepPool
            });
        }

        if (sweepResult?.status === 'cooldown') {
            return res.status(429).json({
                success: false,
                error: sweepResult.error || lastError || 'Memory sweep cooldown active.',
                savedCount,
                pool: sweepPool,
                remainingSeconds: Number(sweepResult.remainingSeconds || 0)
            });
        }

        if (savedCount > 0) {
            return res.json({
                success: true,
                savedCount,
                pool: sweepPool,
                consumedCount: Number(sweepResult?.consumedCount || 0),
                warning: lastError || '',
                message: `Long-term memory sweep completed for ${sweepPool}. Saved ${savedCount} memories.`
            });
        }

        if (lastError) {
            return res.status(400).json({
                success: false,
                error: lastError,
                savedCount,
                pool: sweepPool
            });
        }

        res.json({
            success: true,
            savedCount,
            pool: sweepPool,
            consumedCount: Number(sweepResult?.consumedCount || 0),
            message: savedCount > 0 ? `Long-term memory sweep completed for ${sweepPool}.` : `No new long-term memories were extracted for ${sweepPool}.`
        });
    } catch (e) {
        console.error('Manual sweep failed:', e);
        res.status(500).json({ error: e.message });
    }
});
}
module.exports = { register };
