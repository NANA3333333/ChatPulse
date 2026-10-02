// POST /api/characters/:id/relationships/regenerate
function register(dependencies) {
dependencies.app.post('/api/characters/:id/relationships/regenerate', require("../../../platform/http/trace.js").traceHttp("relationships", "POST /api/characters/:id/relationships/regenerate"), dependencies.authMiddleware, async (req, res) => {
        const db = dependencies.getUserDb(req.user.id);
        try {
            const { target_id } = req.body;
            if (!target_id) return res.status(400).json({ error: 'target_id required' });
            const fromChar = db.getCharacter(req.params.id);
            const toChar = db.getCharacter(target_id);
            if (!fromChar || !toChar) return res.status(404).json({ error: 'Character not found' });

            const out = await dependencies.regenerateImpression({ callLLM: dependencies.callLLM, fromChar, toChar });
            if (!out) return res.status(500).json({ error: `Both attempts returned no valid JSON.Check your Gemini API config.` });

            db.initCharRelationship(fromChar.id, toChar.id, out.affinity, out.impression, 'recommend');
            res.json({ success: true, affinity: out.affinity, impression: out.impression });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
module.exports = { register };
